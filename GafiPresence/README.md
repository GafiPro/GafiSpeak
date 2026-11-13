# GafiPresence

A clean Windows desktop editor for custom Discord Rich Presence. Built as a standalone Electron app and kept separate from the GafiSpeak source code.

## Features in the first build

- Live Discord-style preview while editing.
- Configurable activity name, details, state and activity type.
- Large and small image keys, hover tooltips and up to two buttons.
- Elapsed-time and countdown modes.
- Built-in original SVG artwork gallery.
- Upload local PNG, JPG, WEBP and GIF files for previews and local asset management.
- Save multiple presets, import/export JSON and choose an accent colour.
- Discord RPC connection status, reconnect and clear-presence controls.
- Windows portable build through GitHub Actions.

## Requirements

- Windows 10/11 x64.
- Discord desktop app open and signed in.
- A Discord application created in the Developer Portal. Copy its Application ID into Settings.
- Node.js 22.12 or newer for development.

## Run from source

\`\`\`powershell
cd GafiPresence
npm install
npm start
\`\`\`

## Build a Windows portable executable

\`\`\`powershell
npm install
npm run build:win
\`\`\`

The portable executable is written to \`dist/\`.

## Set up Discord Rich Presence

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create or select an application.
3. Copy its Application ID into **Settings → Discord Application ID** in GafiPresence.
4. Open **Rich Presence → Art Assets** in that application to upload images you want to display.
5. Give each uploaded asset a key, then put that exact key in the Large Image or Small Image key field.
6. Keep the Discord desktop app open and press **Connect**, then **Apply presence**.

### Important: local uploads vs Discord assets

An image uploaded from your computer is stored locally by GafiPresence and is immediately available in the editor preview and asset gallery. The local file path itself cannot be sent as a Discord image key. Use the **Transferir Large PNG** or **Transferir Small PNG** buttons on the Assets page to export the selected artwork, upload that PNG to your Discord application's Rich Presence Art Assets and enter its asset key in GafiPresence. A supported external image URL can also be entered as the image key.

The app keeps the local preview path and the Discord asset key as separate values so the preview never implies an image was published when it was not.

## Rich Presence limits

- Discord displays the application name from the registered Discord application.
- Details and State are limited to 128 characters each.
- A maximum of two custom buttons is supported.
- Button URLs must be valid HTTP or HTTPS links.
- The elapsed timer uses a start timestamp; the countdown uses an end timestamp.
- RPC is local to the Discord desktop client. This is not a bot and does not require a bot token.

## Local data and privacy

Settings, saved presets and uploaded preview images are stored in the current Windows user's Electron user-data directory. The app does not need a Discord bot token and does not send your local images to a GafiPresence server. Import/export files are ordinary JSON.
