import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { AudioPlayerStatus, createAudioResource } from "@discordjs/voice";
import { generateSpeech } from "./kokoro-worker-client.js";

if (ffmpegPath) {
  process.env.FFMPEG_PATH ??= ffmpegPath;
}

const BATCH_WINDOW_MS = 350;
const MAX_BATCH_MESSAGES = 8;
const MAX_BATCH_CHARACTERS = 1200;

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
        const jobGeneration = this.generation;
        let filePath;

        try {
          if (jobGeneration !== this.generation) continue;

          // Collect nearby chat messages so one model call can speak them together.
          await new Promise((resolve) => setTimeout(resolve, BATCH_WINDOW_MS));
          if (jobGeneration !== this.generation) continue;

          const batch = [];
          let batchCharacters = 0;

          while (this.items.length > 0 && batch.length < MAX_BATCH_MESSAGES) {
            const next = this.items[0];
            if (batch.length > 0 && batchCharacters + next.length > MAX_BATCH_CHARACTERS) break;

            batch.push(this.items.shift());
            batchCharacters += next.length;
          }

          if (batch.length === 0) continue;

          const spokenText = batch.join(". ");
          filePath = path.join(tmpdir(), "gafispeak-" + randomUUID() + ".wav");

          if (batch.length > 1) {
            console.log("[GafiSpeak] Combining " + batch.length + " queued messages into one speech request.");
          }

          const generated = await generateSpeech(
            spokenText,
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
          if (filePath) await rm(filePath, { force: true }).catch(() => {});
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
