# GafiSpeak

GafiSpeak is a Discord voice bot that reads all text messages written by its configured owner aloud in the voice channel the bot has joined, regardless of language.

## Features

- Reads messages written by one configured Discord user, across guild text channels the bot can access.
- Uses the official Kokoro-82M PyTorch model with one fixed American male voice (`am_fenrir`).
- Runs speech generation locally on the NVIDIA GPU through CUDA; no paid TTS API or provider request limits.
- Keeps the Python model loaded in GPU memory between messages.
- Queues messages and plays them in order. Rapid messages are combined into a single synthesis request.
- Slash commands: `/join`, `/volume`, and `/leave`.
- The queue is cleared when the bot leaves the voice channel.

## Requirements

- Node.js 22.12.0 or newer.
- Python 3.12 (64-bit).
- A CUDA-capable NVIDIA GPU and a working CUDA-enabled PyTorch installation. The bot explicitly requests CUDA and will report an error rather than silently falling back to CPU.
- An internet connection on the first Python-model run so the Kokoro weights and voice files can be downloaded and cached.
- A Discord application and bot account.
- The bot invited with the `bot` and `applications.commands` scopes and permissions to view text channels, connect to voice channels, and speak.
- The **Message Content Intent** enabled in the Discord Developer Portal.

## Setup

1. Install Node dependencies:

   ```powershell
   npm.cmd install
   ```

2. Create the Python environment if it does not exist:

   ```powershell
   py -V:3.12 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install --upgrade pip
   ```

3. Install a CUDA-enabled PyTorch build that matches your supported Python/driver combination. Confirm it with:

   ```powershell
   .\.venv\Scripts\python.exe -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CUDA unavailable')"
   ```

4. Install Kokoro's Python inference dependencies:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements-tts.txt
   ```

5. On Windows, install eSpeak NG for English out-of-vocabulary pronunciation fallback and other language support. Download the x64 MSI from the official [eSpeak NG releases](https://github.com/espeak-ng/espeak-ng/releases), install it, then restart PowerShell.

6. Copy `.env.example` to `.env` and fill in:

   - `DISCORD_TOKEN`: the bot token.
   - `CLIENT_ID`: the Discord application ID.
   - `OWNER_ID`: your Discord user ID. Only this account's messages are spoken and only this account can use the commands.
   - `GUILD_ID` (optional): set this to your server ID to register commands immediately in that server. Leave it empty to register global commands.

7. Enable **Message Content Intent** under *Developer Portal → Bot → Privileged Gateway Intents*.

8. Register the slash commands:

   ```powershell
   npm.cmd run deploy:commands
   ```

9. Start the bot:

   ```powershell
   npm.cmd start
   ```

The first start loads and downloads the official PyTorch model and voice files. The model is then kept in GPU memory for the lifetime of the worker process. Later restarts reuse the local Hugging Face cache. The worker starts automatically when the first message needs speech.

## Commands

| Command | Description |
| --- | --- |
| `/join` | Join the voice channel you are currently in. |
| `/volume percent:` | Set playback volume from 0 to 100. |
| `/leave` | Leave the voice channel and clear pending speech. |

## Behaviour and limits

- GafiSpeak only queues messages while it is connected to a voice channel.
- Messages from anyone except `OWNER_ID`, bot messages, webhooks, and direct messages are ignored.
- No language filter is applied: Portuguese, English, slang, abbreviations, and short messages are all sent to the same American English voice. Non-English pronunciation may not sound natural.
- URLs and raw Discord mention IDs are removed from spoken text. Markdown and custom emoji markup are simplified.
- A bounded queue prevents unlimited memory usage. If it is full, new messages are skipped and a warning is written to the bot console. Messages arriving within a short window are combined (up to 8 messages / 1,200 characters) to reduce repeated synthesis overhead.
- Speech is synthesized locally by PyTorch and Kokoro on the configured NVIDIA GPU. There are no hosted TTS request limits or per-character API charges, but generation speed depends on the computer and available GPU memory.

## Development

Run the Node tests with:

```powershell
npm.cmd test
```

Check the Python worker syntax with:

```powershell
.\.venv\Scripts\python.exe -m py_compile src/kokoro_worker.py
```

## Privacy

The bot reads message content that Discord delivers to it in servers where it has access. Configure `OWNER_ID` carefully and grant only the Discord permissions it needs. It does not store message history; generated audio is written to a temporary directory and deleted after playback. Kokoro model weights and voice assets are cached locally by the Python inference libraries.
