import test from "node:test";
import assert from "node:assert/strict";
import { toSpeechText } from "../src/text.js";

test("preserves Portuguese, English, slang, and short messages for speech", () => {
  for (const message of [
    "Hello!",
    "olá",
    "bom dia",
    "tá fixe",
    "ngl that was crazy",
    "bro you're cracked",
    "gg",
    "lmao",
    "I'm ready",
    "nice shot"
  ]) {
    assert.equal(toSpeechText(message), message);
  }
});

test("removes links and Discord mention IDs from spoken text", () => {
  assert.equal(
    toSpeechText("Hello <@12345678901234567> [there](https://example.com) https://example.org"),
    "Hello there"
  );
});

test("simplifies markdown and custom emoji markup", () => {
  const tick = String.fromCharCode(96);
  assert.equal(toSpeechText("**Hello** <a:wave:12345678901234567> " + tick + "world" + tick), "Hello wave world");
});

test("keeps readable words around punctuation and emoji", () => {
  assert.equal(toSpeechText("olá 😎 bro!!!"), "olá bro!!!");
});
