import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits
} from "discord.js";
import {
  VoiceConnectionStatus,
  createAudioPlayer,
  entersState,
  joinVoiceChannel
} from "@discordjs/voice";
import { config } from "./config.js";
import { SpeechQueue } from "./speech-queue.js";
import { shutdownKokoroWorker } from "./kokoro-worker-client.js";
import { toSpeechText } from "./text.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

const sessions = new Map();

function closeSession(guildId) {
  const session = sessions.get(guildId);
  if (!session) return false;

  sessions.delete(guildId);
  session.queue.clear();

  if (session.connection.state.status !== VoiceConnectionStatus.Destroyed) {
    session.connection.destroy();
  }

  return true;
}

async function handleJoin(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const channel = member.voice.channel;

    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await interaction.editReply("Join a regular voice channel first, then use /join.");
      return;
    }

    const permissions = channel.permissionsFor(client.user);
    const requiredPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak
    ];

    if (!permissions?.has(requiredPermissions)) {
      await interaction.editReply("I need View Channel, Connect, and Speak permissions in that voice channel.");
      return;
    }

    const currentSession = sessions.get(interaction.guildId);

    if (currentSession?.channelId === channel.id) {
      await interaction.editReply("I'm already in " + channel.name + ".");
      return;
    }

    if (currentSession) closeSession(interaction.guildId);

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    const player = createAudioPlayer();
    const queue = new SpeechQueue(player, { maxQueueSize: config.maxQueueSize });
    const session = {
      channelId: channel.id,
      connection,
      player,
      queue,
      volume: 75
    };

    sessions.set(interaction.guildId, session);
    connection.subscribe(player);

    connection.on("stateChange", (_oldState, newState) => {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        const activeSession = sessions.get(interaction.guildId);
        if (activeSession?.connection === connection) {
          closeSession(interaction.guildId);
          console.warn("[GafiSpeak] Voice connection was lost; the queue was cleared.");
        }
      }
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    } catch (error) {
      closeSession(interaction.guildId);
      throw new Error("I couldn't connect to that voice channel. Check my permissions and try again.", { cause: error });
    }

    await interaction.editReply(
      "Joined " + channel.name + ". I'll read your messages aloud in this server while I'm connected."
    );
  } catch (error) {
    console.error("[GafiSpeak] Join failed:", error);
    await interaction.editReply(error.message || "Something went wrong while joining the voice channel.");
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log("[GafiSpeak] Logged in as " + readyClient.user.tag);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.user.id !== config.ownerId) {
    await interaction.reply({
      content: "These commands are restricted to the bot owner.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({ content: "Use this command in a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    if (interaction.commandName === "join") {
      await handleJoin(interaction);
      return;
    }

    if (interaction.commandName === "volume") {
      const session = sessions.get(interaction.guildId);

      if (!session) {
        await interaction.reply({ content: "Use /join first.", flags: MessageFlags.Ephemeral });
        return;
      }

      const percent = interaction.options.getInteger("percent", true);
      session.queue.setVolume(percent);
      session.volume = percent;

      await interaction.reply({
        content: "Volume set to " + percent + "%.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (interaction.commandName === "leave") {
      const left = closeSession(interaction.guildId);

      await interaction.reply({
        content: left ? "Left the voice channel and cleared the speech queue." : "I'm not in a voice channel.",
        flags: MessageFlags.Ephemeral
      });
    }
  } catch (error) {
    console.error("[GafiSpeak] Command failed:", error);

    const response = { content: "The command failed. Check the bot console for details.", flags: MessageFlags.Ephemeral };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(response.content).catch(() => {});
    } else {
      await interaction.reply(response).catch(() => {});
    }
  }
});

client.on(Events.MessageCreate, (message) => {
  if (!message.guild || message.author.bot || message.webhookId) return;
  if (message.author.id !== config.ownerId) return;

  const session = sessions.get(message.guild.id);
  if (!session || session.connection.state.status !== VoiceConnectionStatus.Ready) return;

  const speechText = toSpeechText(message.content);
  if (!speechText) return;

  if (!session.queue.enqueue(speechText)) {
    console.warn("[GafiSpeak] Speech queue is full; a new message was skipped.");
    return;
  }

  console.log(
    "[GafiSpeak] Queued a message (" + speechText.length +
    " characters; " + session.queue.items.length + " waiting)."
  );
});

client.on(Events.Error, (error) => {
  console.error("[GafiSpeak] Discord client error:", error);
});

async function shutdown(signal) {
  console.log("[GafiSpeak] Received " + signal + "; shutting down.");
  for (const guildId of sessions.keys()) closeSession(guildId);
  shutdownKokoroWorker();
  client.destroy();
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

client.login(config.token).catch((error) => {
  console.error("[GafiSpeak] Login failed:", error);
  process.exitCode = 1;
});
