import { franc } from "franc-min";

const SHORT_ENGLISH_WORDS = new Set(
  (
    "a an and are as at away back bad be because been before best better big bit bro bruh " +
    "but bye can cant cannot cya cool could day did didnt do does doing dont down dude " +
    "easy even ever every few fine for fr from fun get gg glad go going gonna good got great " +
    "guys had has have he hello help her here hey hi him his how huh i idk if ill im in into " +
    "is it its ive just keep kind know later let lets like little lmao lol look love made make " +
    "man many may me mine more most much my nah need never new next nice no not now of off " +
    "oh okay ok old on one only or other our out over people pls please play playing pretty " +
    "probably rn really ready right rofl same say see she should sick so some someone something sorry " +
    "still stop sure sup take talk tell test testing than thanks that the their them then there these they " +
    "thing think this tho those though time to today together too try ty u uh um up us use very " +
    "wait wanna want was way we well were what whats thats crazy shot sec problem sucks when where which who why will with work worry would " +
    "wow wtf yeah ye yes you your yours yw afk brb gl hf idc imho imo lmk np nt omw tbh thx wp " +
    "ez ggwp lmfao hahaha ahaha hahah huhh discord voice chat server"
  ).split(/\s+/)
);

export function toSpeechText(input) {
  if (typeof input !== "string") return "";

  return input
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, " $1 ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/<a?:([a-z0-9_]+):\d+>/gi, " $1 ")
    .replace(/<@!?&?\d+>|<#\d+>/g, " ")
    .replace(/<t:\d+(?::[tTdDfFR])?>/g, " ")
    .replace(/\x60{3}[a-z0-9_-]*\s*([\s\S]*?)\x60{3}/gi, " $1 ")
    .replace(/\x60([^\x60]+)\x60/g, " $1 ")
    .replace(/^\s*>\s?/gm, " ")
    .replace(/@everyone/gi, " everyone ")
    .replace(/@here/gi, " here ")
    .replace(/[*_~|]/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEnglish(input) {
  if (typeof input !== "string") return false;

  const normalized = input.toLowerCase().replace(/[’‘]/g, "'").trim();
  const tokens = normalized.match(/\p{L}+(?:'\p{L}+)*/gu) ?? [];
  const letterCount = (normalized.match(/\p{L}/gu) ?? []).length;

  if (tokens.length === 0) return false;

  if (letterCount < 20) {
    return tokens.every((token) => SHORT_ENGLISH_WORDS.has(token.replaceAll("'", "")));
  }

  return franc(normalized, { minLength: 10 }) === "eng";
}
