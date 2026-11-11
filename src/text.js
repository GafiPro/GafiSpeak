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
