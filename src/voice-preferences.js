import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_VOICE_ID, isAvailableVoice } from "./voice-catalog.js";

const preferencesPath = path.resolve(process.cwd(), "data", "voice-preferences.json");
const preferences = new Map();

export async function loadVoicePreferences() {
  try {
    const raw = await readFile(preferencesPath, "utf8");
    const saved = JSON.parse(raw);

    for (const [guildId, voiceId] of Object.entries(saved)) {
      if (isAvailableVoice(voiceId)) {
        preferences.set(guildId, voiceId);
      }
    }

    console.log("[GafiSpeak] Loaded voice preferences for " + preferences.size + " server(s).");
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("[GafiSpeak] Could not load saved voice preferences:", error.message);
    }
  }
}

export function getGuildVoicePreference(guildId) {
  return preferences.get(guildId) ?? DEFAULT_VOICE_ID;
}

export async function setGuildVoicePreference(guildId, voiceId) {
  if (!isAvailableVoice(voiceId)) {
    throw new Error("That voice ID is not in the Kokoro voice catalogue.");
  }

  const next = new Map(preferences);
  next.set(guildId, voiceId);

  await mkdir(path.dirname(preferencesPath), { recursive: true });
  const temporaryPath = preferencesPath + ".tmp";
  await writeFile(temporaryPath, JSON.stringify(Object.fromEntries(next), null, 2) + "\n", "utf8");
  await rename(temporaryPath, preferencesPath);

  preferences.clear();
  for (const [savedGuildId, savedVoiceId] of next) {
    preferences.set(savedGuildId, savedVoiceId);
  }
}
