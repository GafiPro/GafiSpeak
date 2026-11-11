import test from "node:test";
import assert from "node:assert/strict";
import {
  AVAILABLE_VOICES,
  DEFAULT_VOICE_ID,
  getVoiceById,
  isAvailableVoice
} from "../src/voice-catalog.js";

test("catalogue contains all 54 published Kokoro-82M voices", () => {
  assert.equal(AVAILABLE_VOICES.length, 54);
  assert.equal(new Set(AVAILABLE_VOICES.map((voice) => voice.id)).size, 54);
});

test("default voice exists in the catalogue", () => {
  assert.equal(DEFAULT_VOICE_ID, "am_fenrir");
  assert.equal(isAvailableVoice(DEFAULT_VOICE_ID), true);
  assert.equal(getVoiceById(DEFAULT_VOICE_ID)?.name, "Fenrir");
});

test("voice lookup rejects unknown IDs", () => {
  assert.equal(isAvailableVoice("not_a_voice"), false);
  assert.equal(getVoiceById("not_a_voice"), null);
});
