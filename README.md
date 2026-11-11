# GafiSpeak

GafiSpeak is a Discord voice bot that reads all text messages written by its configured owner aloud in the voice channel the bot has joined, regardless of language.

## Features

- Reads messages written by one configured Discord user, across guild text channels the bot can access.
- Uses the local Kokoro-82M text-to-speech model with one fixed American male voice (`am_fenrir`).
- Runs speech generation locally on the bot's computer; no paid TTS API or provider request limits.
- Queues messages and plays them in order, without interrupting the current message. Rapid messages are combined into a single synthesis request to reduce repeated model overhead.
- Slash commands: `/join`, `/volume`, and `/leave`.
- The queue is cleared when the bot leaves the voice channel.

## Requirements

- Node.js 22.12.0 or newer.
- An internet connection on the first run so Kokoro can download its model and voice files. The files are cached locally for later runs.
- Enough CPU and memory to run local text-to-speech. Generation speed depends on the computer.
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

The first start that generates speech downloads the Kokoro model and voice files. This may take a little while. The files are cached, so they are not downloaded on every restart.

## Commands

| Command | Description |
| --- | --- |
| `/join` | Join the voice channel you are currently in. |
| `/volume percent:` | Set playback volume from 0 to 100. |
| `/leave` | Leave the voice channel and clear pending speech. |

## Behaviour and limits

- GafiSpeak only queues messages while it is connected to a voice channel.
- Messages from anyone except `OWNER_ID`, bot messages, webhooks, and direct messages are ignored.
- No language filter is applied: Portuguese, English, slang, abbreviations, and short messages are all sent to the same English voice. Non-English pronunciation may not sound natural.
- URLs and raw Discord mention IDs are removed from spoken text. Markdown and custom emoji markup are simplified.
- A bounded queue prevents unlimited memory usage. If it is full, new messages are skipped and a warning is written to the bot console. Messages arriving within a short window are combined (up to 8 messages / 1,200 characters) to reduce synthesis calls.
- Kokoro generates audio locally. There are no hosted TTS request limits or per-character API charges, but the speed of generation depends on the computer. The current Node.js setup uses CPU inference.

## Development

Run the tests with:

```bash
npm test
```

## Privacy

The bot reads message content that Discord delivers to it in servers where it has access. Configure `OWNER_ID` carefully and grant only the Discord permissions it needs. It does not store message history; generated audio is written to a temporary directory and deleted after playback. The Kokoro model and voice files are cached locally by the inference library.
