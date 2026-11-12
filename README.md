# GafiSpeak

GafiSpeak is a Discord voice bot that reads all text messages written by its configured owner aloud in the voice channel the bot has joined, regardless of language.

## Features

- Reads messages written by one configured Discord user, across guild text channels the bot can access.
- Uses the official Kokoro-82M PyTorch model with a selectable catalogue of 54 voices (default: `am_fenrir`).
- Automatically uses an NVIDIA GPU through CUDA when available, or falls back to the CPU when no CUDA-capable GPU is available.
- Keeps the Kokoro model loaded in GPU memory or system RAM between messages.
- Queues messages and plays them in order. Rapid messages are combined into a single synthesis request.
- Slash commands: `/join`, `/voice`, `/volume`, and `/leave`.
- The queue is cleared when the bot leaves the voice channel. Voice preferences are saved in `data/voice-preferences.json`.

## Windows desktop manager

A portable Windows app is available to control the bot without opening PowerShell.

1. Download the GafiSpeak Manager portable executable from the latest successful **Windows Manager** workflow run in the GitHub Actions tab.
2. Put GafiSpeak-Manager-1.0.0-Portable.exe in the main GafiSpeak project folder, next to .env and package.json.
3. Double-click the executable. Press **Iniciar** to start the bot and **Parar** to stop it.
4. The live log shows bot and Kokoro output. **Copiar log** copies the session history for troubleshooting.

The manager uses the existing Node.js dependencies, .env file, and .venv folder. It does not reinstall or modify the Python environment. Keep the project folder in place while the manager is running. Closing the manager also stops the bot.

The manager also publishes a Discord Rich Presence using the existing CLIENT_ID from .env. Keep the Discord desktop client open and signed in: the activity appears on your personal Discord profile, not on the bot account. It shows whether GafiSpeak is starting, online, or stopped, includes the running time, and provides GitHub and Kokoro links. The manager never uses or sends your bot token for Rich Presence. If Discord is closed, the app retries automatically.

## Requirements

- Node.js 22.12.0 or newer.
- Python 3.12 (64-bit).
- PyTorch and Kokoro. An NVIDIA GPU is optional: GafiSpeak uses CUDA automatically when available and otherwise runs on the CPU.
- An internet connection on the first Python-model run so the Kokoro weights and voice files can be downloaded and cached.
- A Discord application and bot account.
- The bot invited with the `bot` and `applications.commands` scopes and permissions to view text channels, connect to voice channels, and speak.
- The **Message Content Intent** enabled in the Discord Developer Portal.

**Performance note:** CPU mode is supported, but speech generation can be noticeably slower than CUDA. On a laptop without an NVIDIA GPU, the bot still works; shorter messages will generally be quicker to synthesize. The model is kept in system RAM while the worker is running.

## Setup

1. Install Node dependencies:

   ```powershell
   npm.cmd install
   ```

2. Create the Python environment if it does not exist:

   ```powershell
   py -V:3.12 -m venv .venv
   .\\.venv\\Scripts\\python.exe -m pip install --upgrade pip
   ```

3. Install the PyTorch build that matches your computer.

   **For a computer without an NVIDIA GPU (CPU-only):**

   ```powershell
   .\\.venv\\Scripts\\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
   ```

   **For a computer with a supported NVIDIA GPU:** install a CUDA-enabled PyTorch build that matches your Python version and NVIDIA driver, using the official PyTorch installation selector.

   Confirm which device PyTorch can use:

   ```powershell
   .\\.venv\\Scripts\\python.exe -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('Device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
   ```

   GafiSpeak selects CUDA automatically when PyTorch can access it; otherwise it selects the CPU.

4. Install Kokoro's Python inference dependencies:

   ```powershell
   .\\.venv\\Scripts\\python.exe -m pip install -r requirements-tts.txt
   ```

5. Copy `.env.example` to `.env` and fill in:

   - `DISCORD_TOKEN`: the bot token.
   - `CLIENT_ID`: the Discord application ID.
   - `OWNER_ID`: your Discord user ID. Only this account's messages are spoken and only this account can use the commands.
   - `GUILD_ID` (optional): set this to your server ID to register commands immediately in that server. Leave it empty to register global commands.

6. Enable **Message Content Intent** under *Developer Portal → Bot → Privileged Gateway Intents*.

7. Register the slash commands:

   ```powershell
   npm.cmd run deploy:commands
   ```

8. Start the bot:

   ```powershell
   npm.cmd start
   ```

The first start loads and downloads the official PyTorch model and voice files. The model is then kept in GPU memory when CUDA is available, or system RAM in CPU mode, for the lifetime of the worker process. Later restarts reuse the local Hugging Face cache. The worker starts automatically when the first message needs speech.

## Commands

| Command | Description |
| --- | --- |
| `/join` | Join the voice channel you are currently in. |
| `/voice` | Open a paginated selector containing all 54 Kokoro voices. The choice is saved per server. |
| `/volume percent:` | Set playback volume from 0 to 100. |
| `/leave` | Leave the voice channel and clear the speech queue. |

## Behaviour and limits

- GafiSpeak only queues messages while it is connected to a voice channel.
- Messages from anyone except `OWNER_ID`, bot messages, webhooks, and direct messages are ignored.
- No language filter is applied: messages in any language are sent to the selected Kokoro voice. The text phonemizer remains configured for American English, so selecting a voice designed for another language changes the voice preset but does not automatically translate or switch text-language processing.
- URLs and raw Discord mention IDs are removed from spoken text. Markdown and custom emoji markup are simplified.
- A bounded queue prevents unlimited memory usage. If it is full, new messages are skipped and a warning is written to the bot console. Messages arriving within a short window are combined (up to 8 messages / 1,200 characters) to reduce repeated synthesis overhead.
- Speech is synthesized locally by PyTorch and Kokoro, using the NVIDIA GPU when CUDA is available and otherwise the CPU. There are no hosted TTS request limits or per-character API charges, but generation speed depends on the computer and available GPU/CPU performance. The `/voice` menu contains all 54 voice IDs published for Kokoro-82M and is split into pages to fit Discord selection-menu limits.

## Development

Run the Node tests with:

```powershell
npm.cmd test
```

Check the Python worker syntax with:

```powershell
.\\.venv\\Scripts\\python.exe -m py_compile src/kokoro_worker.py
```

## Privacy

The bot reads message content that Discord delivers to it in servers where it has access. Configure `OWNER_ID` carefully and grant only the Discord permissions it needs. It does not store message history; generated audio is written to a temporary directory and deleted after playback. Kokoro model weights and voice assets are cached locally by the Python inference libraries.
