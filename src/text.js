// English words and common gaming / internet chat slang. Short messages are
// difficult for language detectors, so these are checked against this allowlist.
const SHORT_ENGLISH_WORDS = new Set(
  (
    "a an and are as at away back bad based be because been before best better bet big bit " +
    "bro bruh but bussin bye can cant cap cannot cooked cracked crazy cringe clutch cool could " +
    "day deadass damn diff did didnt do does doing dont down dude easy even ever every few fine " +
    "finna for fr frfr from fuck fucked fucking fun funny get getting gg ggs glad gl go going " +
    "gonna good got gotta great guys had haha hahah hahaha happen has have he hell hello help " +
    "her here hey highkey hi him his holy hours how hbu huh i idc idk ik ikr ill im imo imho " +
    "in into is it its ive just keep kinda kind know later legit let lets lmao lmk lol lowkey " +
    "love made make man many may mb me mid mine more most much my nah need never new next nice " +
    "ngl no np nt nvm of off oh okay ok old omg omw on ong one only or other our out over people " +
    "pls please play playing pretty probably rn rofl rn ready real really right same say see she " +
    "shit shits should sick skill slow smh so some someone something sorry sus still stop sucks " +
    "sure sup tbh tf than thanks that thats the their them then there these they thing think this " +
    "tho those though time to today together too try ttyl ty u uh um up us use very wait wanna " +
    "want was way we well were what whats when where which who why will with work worry would " +
    "wow wtf ya yeah ye yes yall you your youre yours yw afk brb btw asap fyi frfr wyd wdym wya " +
    "ez ggwp lmfao ahaha huhh discord voice chat server game games gaming player players team " +
    "teams match matches lobby lobbies ranked rank comp casual queue reset resets aerial shot " +
    "shots goal goals save saves demo demos boost flip musty stall fennec octane rocket league " +
    "skill issue no cap my bad lets go lets goo goated goat cooked cooking cooking rn insane " +
    "crazy nice shot well played good game good shit holy moly what the hell shut up stfu kys " +
    "ass asshole damn bro nah fam gang twin chief mate dude man guys"
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
