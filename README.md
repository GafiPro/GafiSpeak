# GafiSpeak

GafiSpeak is a Discord voice bot that reads the owner's English text messages aloud in the voice channel the bot has joined.

## Features

- Reads messages written by one configured Discord user, across guild text channels the bot can access.
- Speaks English messages only, using one fixed male English voice (Microsoft Edge TTS: `en-US-GuyNeural`).
- Queues messages and plays them in order, without interrupting the current message.
- Slash commands: `/join`, `/volume`, and `/leave`.
- The queue is cleared when the bot leaves the voice channel.

## Requirements

- Node.js 22.12.0 or newer.
- A Discord application and bot account.
- The bot invited with the `bot` and `applications.commands` scopes and permissions to view text channels, connect to voice channels, and speak.
- The **Message Content Intent** enabled in the Discord Developer Portal.

## Setup

1. Clone this repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in:

   - `DISCORD_TOKEN`: the bot token.
   - `CLIENT_ID`: the Discord application ID.
   - `OWNER_ID`: your Discord user ID. Only this account's messages are spoken and only this account can use the commands.
   - `GUILD_ID` (optional): set this to your server ID to register commands immediately in that server. Leave it empty to register global commands.

3. Enable **Message Content Intent** under *Developer Portal → Bot → Privileged Gateway Intents*.

4. Register the slash commands:

   ```bash
   npm run deploy:commands
   ```

5. Start the bot:

   ```bash
   npm start
   ```

## Commands

| Command | Description |
| --- | --- |
| `/join` | Join the voice channel you are currently in. |
| `/volume percent:` | Set playback volume from 0 to 100. |
| `/leave` | Leave the voice channel and clear pending speech. |

## Behaviour and limits

- GafiSpeak only queues messages while it is connected to a voice channel.
- Messages from anyone except `OWNER_ID`, bot messages, webhooks, and direct messages are ignored.
- Language detection is best-effort. Very short messages are accepted only when their words match a small English-word allowlist; longer messages are checked with `franc-min`. Ambiguous or non-English messages are ignored.
- URLs and raw Discord mention IDs are removed from spoken text. Markdown and custom emoji markup are simplified.
- A bounded queue prevents unlimited memory usage. If it is full, new messages are skipped and a warning is written to the bot console.
- Text-to-speech uses Microsoft Edge's online TTS service through `node-edge-tts`; an internet connection is required. This is not an official Microsoft cloud API and its availability can change.

## Development

Run the tests with:

```bash
npm test
```

## Privacy

The bot reads message content that Discord delivers to it in servers where it has access. Configure `OWNER_ID` carefully and grant only the Discord permissions it needs. It does not store message history; generated audio is written to a temporary directory and deleted after playback.
