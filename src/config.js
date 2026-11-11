import "dotenv/config";

const requiredNames = ["DISCORD_TOKEN", "CLIENT_ID", "OWNER_ID"];
const missingNames = requiredNames.filter((name) => !process.env[name]?.trim());

if (missingNames.length > 0) {
  throw new Error("Missing environment variables: " + missingNames.join(", ") + ". Copy .env.example to .env and fill it in.");
}

const snowflakePattern = /^\d{17,20}$/;

for (const name of ["CLIENT_ID", "OWNER_ID"]) {
  if (!snowflakePattern.test(process.env[name])) {
    throw new Error(name + " must be a valid Discord ID (17–20 digits).");
  }
}

const guildId = process.env.GUILD_ID?.trim() || null;

if (guildId && !snowflakePattern.test(guildId)) {
  throw new Error("GUILD_ID must be a valid Discord ID (17–20 digits) or left empty.");
}

const maxQueueSize = Number(process.env.MAX_QUEUE_SIZE ?? 40);

if (!Number.isInteger(maxQueueSize) || maxQueueSize < 1 || maxQueueSize > 200) {
  throw new Error("MAX_QUEUE_SIZE must be an integer between 1 and 200.");
}

export const config = Object.freeze({
  token: process.env.DISCORD_TOKEN.trim(),
  clientId: process.env.CLIENT_ID,
  ownerId: process.env.OWNER_ID,
  guildId,
  maxQueueSize
});
