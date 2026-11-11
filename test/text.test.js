import test from "node:test";
import assert from "node:assert/strict";
import { isEnglish, toSpeechText } from "../src/text.js";

test("accepts common short English chat messages", () => {
  for (const message of [
    "hi", "gg", "lmao", "what's up", "lets play", "brb",
    "I'm ready", "don't worry", "that's crazy", "nice shot"
  ]) {
    assert.equal(isEnglish(message), true, message);
  }
});

test("accepts common gaming and internet slang", () => {
  for (const message of [
    "ngl that was crazy",
    "bro you're cracked",
    "frfr",
    "you're actually cooked",
    "skill issue",
    "that's cap",
    "no cap",
    "wyd rn",
    "ggs wp",
    "my bad",
    "that's so sus",
    "what the hell",
    "holy shit",
    "u cooked",
    "bruh moment",
    "lmk when you're ready",
    "omw"
  ]) {
    assert.equal(isEnglish(message), true, message);
  }
});

test("rejects short Portuguese messages", () => {
  for (const message of ["olá", "bom dia", "tá fixe", "obrigado", "está tudo bem"]) {
    assert.equal(isEnglish(message), false, message);
  }
});

test("detects longer English messages", () => {
  assert.equal(
    isEnglish("I'm joining the voice channel in a couple of minutes."),
    true
  );
});

test("rejects longer Portuguese messages", () => {
  assert.equal(
    isEnglish("Estou a entrar no canal de voz daqui a alguns minutos."),
    false
  );
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
