import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AudioPlayerStatus, createAudioResource } from "@discordjs/voice";
import { EdgeTTS } from "node-edge-tts";

const tts = new EdgeTTS({
  voice: "en-US-GuyNeural",
  lang: "en-US",
  outputFormat: "audio-24khz-48kbitrate-mono-mp3",
  timeout: 20000
});

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
          await tts.ttsPromise(text, filePath);
          if (jobGeneration !== this.generation) continue;

          const resource = createAudioResource(filePath, { inlineVolume: true });
          resource.volume?.setVolume(this.volume);
          this.currentResource = resource;
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
