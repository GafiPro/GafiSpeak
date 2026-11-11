import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "../src/config.js";

const commands = [
  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Join the voice channel you are currently in."),
  new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set the bot's voice playback volume.")
    .addIntegerOption((option) =>
      option
        .setName("percent")
        .setDescription("Playback volume, from 0 to 100.")
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Leave the voice channel and clear the speech queue.")
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(config.token);
const route = config.guildId
  ? Routes.applicationGuildCommands(config.clientId, config.guildId)
  : Routes.applicationCommands(config.clientId);

try {
  await rest.put(route, { body: commands });
  console.log(
    "[GafiSpeak] Registered " + commands.length + " slash commands " +
    (config.guildId ? "for server " + config.guildId + "." : "globally.")
  );
} catch (error) {
  console.error("[GafiSpeak] Could not register slash commands:", error);
  process.exitCode = 1;
}
