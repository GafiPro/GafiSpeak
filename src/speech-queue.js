import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { AudioPlayerStatus, createAudioResource } from "@discordjs/voice";
import { EdgeTTS } from "node-edge-tts";

if (ffmpegPath) {
  process.env.FFMPEG_PATH ??= ffmpegPath;
}

const tts = new EdgeTTS({
  voice: "en-US-GuyNeural",
  lang: "en-US",
  outputFormat: "audio-24khz-48kbitrate-mono-mp3",
  timeout: 20000
});

// Edge's unofficial TTS endpoint can temporarily rate-limit bursts of requests.
// Keep one shared lane for all guilds, with a gap between each synthesis request.
const MIN_REQUEST_INTERVAL_MS = 5000;
const RETRY_DELAYS_MS = [20000, 60000];
const FINAL_429_COOLDOWN_MS = 60000;

let ttsLane = Promise.resolve();
let nextRequestAt = 0;
let blockedUntil = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimitError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:HTTP\s*)?429|Too Many Requests/i.test(message);
}

async function generateSpeech(text, filePath, isCurrent) {
  // Serialise TTS requests across guilds; separate guild queues must not create a burst.
  const previous = ttsLane;
  let release;
  ttsLane = new Promise((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      if (!isCurrent()) return false;

      const waitUntil = Math.max(nextRequestAt, blockedUntil);
      const waitMs = Math.max(0, waitUntil - Date.now());

      if (waitMs > 0) {
        console.log("[GafiSpeak] TTS pacing: waiting " + Math.ceil(waitMs / 1000) + "s before the next request.");
        await sleep(waitMs);
      }

      if (!isCurrent()) return false;

      nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;

      try {
        console.log("[GafiSpeak] Generating speech audio.");
        await tts.ttsPromise(text, filePath);
        return true;
      } catch (error) {
        if (!isRateLimitError(error)) throw error;

        if (attempt >= RETRY_DELAYS_MS.length) {
          blockedUntil = Date.now() + FINAL_429_COOLDOWN_MS;
          console.error(
            "[GafiSpeak] The TTS service is still rate-limiting requests (HTTP 429). " +
            "This message could not be generated; the next request will wait at least 60s."
          );
          throw error;
        }

        const retryDelay = RETRY_DELAYS_MS[attempt];
        blockedUntil = Date.now() + retryDelay;
        console.warn(
          "[GafiSpeak] TTS rate limit (HTTP 429). Retrying this message in " +
          Math.ceil(retryDelay / 1000) + "s (" + (attempt + 1) + "/" + RETRY_DELAYS_MS.length + ")."
        );
      }
    }

    return false;
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
        const filePath = path.join(tmpdir(), "gafispeak-" + randomUUID() + ".mp3");

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
