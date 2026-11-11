export const DEFAULT_VOICE_ID = "am_fenrir";

export const AVAILABLE_VOICES = Object.freeze([
  { id: "af_alloy", name: "Alloy", language: "American English", gender: "Female" },
  { id: "af_aoede", name: "Aoede", language: "American English", gender: "Female" },
  { id: "af_bella", name: "Bella", language: "American English", gender: "Female" },
  { id: "af_heart", name: "Heart", language: "American English", gender: "Female" },
  { id: "af_jessica", name: "Jessica", language: "American English", gender: "Female" },
  { id: "af_kore", name: "Kore", language: "American English", gender: "Female" },
  { id: "af_nicole", name: "Nicole", language: "American English", gender: "Female" },
  { id: "af_nova", name: "Nova", language: "American English", gender: "Female" },
  { id: "af_river", name: "River", language: "American English", gender: "Female" },
  { id: "af_sarah", name: "Sarah", language: "American English", gender: "Female" },
  { id: "af_sky", name: "Sky", language: "American English", gender: "Female" },
  { id: "am_adam", name: "Adam", language: "American English", gender: "Male" },
  { id: "am_echo", name: "Echo", language: "American English", gender: "Male" },
  { id: "am_eric", name: "Eric", language: "American English", gender: "Male" },
  { id: "am_fenrir", name: "Fenrir", language: "American English", gender: "Male" },
  { id: "am_liam", name: "Liam", language: "American English", gender: "Male" },
  { id: "am_michael", name: "Michael", language: "American English", gender: "Male" },
  { id: "am_onyx", name: "Onyx", language: "American English", gender: "Male" },
  { id: "am_puck", name: "Puck", language: "American English", gender: "Male" },
  { id: "am_santa", name: "Santa", language: "American English", gender: "Male" },
  { id: "bf_alice", name: "Alice", language: "British English", gender: "Female" },
  { id: "bf_emma", name: "Emma", language: "British English", gender: "Female" },
  { id: "bf_isabella", name: "Isabella", language: "British English", gender: "Female" },
  { id: "bf_lily", name: "Lily", language: "British English", gender: "Female" },
  { id: "bm_daniel", name: "Daniel", language: "British English", gender: "Male" },
  { id: "bm_fable", name: "Fable", language: "British English", gender: "Male" },
  { id: "bm_george", name: "George", language: "British English", gender: "Male" },
  { id: "bm_lewis", name: "Lewis", language: "British English", gender: "Male" },
  { id: "ef_dora", name: "Dora", language: "Spanish", gender: "Female" },
  { id: "em_alex", name: "Alex", language: "Spanish", gender: "Male" },
  { id: "em_santa", name: "Santa", language: "Spanish", gender: "Male" },
  { id: "ff_siwis", name: "Siwis", language: "French", gender: "Female" },
  { id: "if_sara", name: "Sara", language: "Italian", gender: "Female" },
  { id: "im_nicola", name: "Nicola", language: "Italian", gender: "Male" },
  { id: "pf_dora", name: "Dora", language: "Brazilian Portuguese", gender: "Female" },
  { id: "pm_alex", name: "Alex", language: "Brazilian Portuguese", gender: "Male" },
  { id: "pm_santa", name: "Santa", language: "Brazilian Portuguese", gender: "Male" },
  { id: "hf_alpha", name: "Alpha", language: "Hindi", gender: "Female" },
  { id: "hf_beta", name: "Beta", language: "Hindi", gender: "Female" },
  { id: "hm_omega", name: "Omega", language: "Hindi", gender: "Male" },
  { id: "hm_psi", name: "Psi", language: "Hindi", gender: "Male" },
  { id: "zf_xiaobei", name: "Xiaobei", language: "Mandarin Chinese", gender: "Female" },
  { id: "zf_xiaoni", name: "Xiaoni", language: "Mandarin Chinese", gender: "Female" },
  { id: "zf_xiaoxiao", name: "Xiaoxiao", language: "Mandarin Chinese", gender: "Female" },
  { id: "zf_xiaoyi", name: "Xiaoyi", language: "Mandarin Chinese", gender: "Female" },
  { id: "zm_yunjian", name: "Yunjian", language: "Mandarin Chinese", gender: "Male" },
  { id: "zm_yunxi", name: "Yunxi", language: "Mandarin Chinese", gender: "Male" },
  { id: "zm_yunxia", name: "Yunxia", language: "Mandarin Chinese", gender: "Male" },
  { id: "zm_yunyang", name: "Yunyang", language: "Mandarin Chinese", gender: "Male" },
  { id: "jf_alpha", name: "Alpha", language: "Japanese", gender: "Female" },
  { id: "jf_gongitsune", name: "Gongitsune", language: "Japanese", gender: "Female" },
  { id: "jf_nezumi", name: "Nezumi", language: "Japanese", gender: "Female" },
  { id: "jf_tebukuro", name: "Tebukuro", language: "Japanese", gender: "Female" },
  { id: "jm_kumo", name: "Kumo", language: "Japanese", gender: "Male" }
]);

const voiceIds = new Set(AVAILABLE_VOICES.map((voice) => voice.id));

export function isAvailableVoice(voiceId) {
  return typeof voiceId === "string" && voiceIds.has(voiceId);
}

export function getVoiceById(voiceId) {
  return AVAILABLE_VOICES.find((voice) => voice.id === voiceId) ?? null;
}
