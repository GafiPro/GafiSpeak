import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { AudioPlayerStatus, createAudioResource } from "@discordjs/voice";
import { KokoroTTS } from "kokoro-js";

if (ffmpegPath) {
  process.env.FFMPEG_PATH ??= ffmpegPath;
}

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const VOICE = "am_fenrir";

// Load the open-weight model once and keep it in memory for all guild queues.
// The first run downloads the model and voice assets; later runs use the local cache.
let kokoroPromise = null;

async function getKokoro() {
  if (!kokoroPromise) {
    console.log("[GafiSpeak] Loading the local Kokoro model. The first run downloads its files.");

    kokoroPromise = KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: "q8",
      device: "cpu"
    }).then((tts) => {
      console.log("[GafiSpeak] Kokoro is ready (voice: " + VOICE + ").");
      return tts;
    }).catch((error) => {
      kokoroPromise = null;
      throw error;
    });
  }

  return kokoroPromise;
}

// Run only one local inference at a time so separate guild queues do not
// overload the same CPU/model instance. This is serialization, not a cooldown.
let generationLane = Promise.resolve();

async function generateSpeech(text, filePath, isCurrent) {
  const previous = generationLane;
  let release;
  generationLane = new Promise((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    if (!isCurrent()) return false;

    const tts = await getKokoro();
    if (!isCurrent()) return false;

    console.log("[GafiSpeak] Generating speech with Kokoro.");
    const audio = await tts.generate(text, {
      voice: VOICE,
      speed: 1
    });

    if (!isCurrent()) return false;

    await audio.save(filePath);
    return true;
  } finally {
    release();
  }
}

export class SpeechQueue {
  constructor(player, options = {}) {
    this.player = player;
    this.maxQueueSize = options.maxQueueSize ?? 40;
    this.volume = 0.75;
    this.items = [];
    this.processing = false;
    this.generation = 0;
    this.currentResource = null;
  }

  get size() {
    return this.items.length + (this.currentResource ? 1 : 0);
  }

  enqueue(text) {
    if (typeof text !== "string" || !text.trim() || this.items.length >= this.maxQueueSize) {
      return false;
    }

    this.items.push(text.trim());
    void this.drain();
    return true;
  }

  setVolume(percent) {
    const safePercent = Math.max(0, Math.min(100, Number(percent)));
    this.volume = safePercent / 100;
    this.currentResource?.volume?.setVolume(this.volume);
  }

  clear() {
    this.items.length = 0;
    this.generation += 1;
    this.currentResource = null;
    this.player.stop(true);
  }

  async drain() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.items.length > 0) {
        const text = this.items.shift();
        const jobGeneration = this.generation;
        const filePath = path.join(tmpdir(), "gafispeak-" + randomUUID() + ".wav");

        try {
          const generated = await generateSpeech(
            text,
            filePath,
            () => jobGeneration === this.generation
          );

          if (!generated || jobGeneration !== this.generation) continue;

          const resource = createAudioResource(filePath, { inlineVolume: true });
          resource.volume?.setVolume(this.volume);
          this.currentResource = resource;
          console.log("[GafiSpeak] Playing generated speech.");
          await this.playResource(resource);
        } catch (error) {
          if (jobGeneration === this.generation) {
            console.error("[GafiSpeak] Could not generate or play speech:", error);
          }
        } finally {
          this.currentResource = null;
          await rm(filePath, { force: true }).catch(() => {});
        }
      }
    } finally {
      this.currentResource = null;
      this.processing = false;
      if (this.items.length > 0) void this.drain();
    }
  }

  playResource(resource) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.player.off(AudioPlayerStatus.Idle, onIdle);
        this.player.off("error", onError);
      };

      const onIdle = () => {
        cleanup();
        resolve();
      };

      const onError = (error) => {
        cleanup();
        reject(error);
      };

      this.player.once(AudioPlayerStatus.Idle, onIdle);
      this.player.once("error", onError);

      try {
        this.player.play(resource);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }
}
