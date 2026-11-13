const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const APP_ID = "com.gafipro.gafipresence";
let mainWindow = null;
let rpcClient = null;
let rpcReady = false;
let rpcConnecting = false;
let reconnectTimer = null;
let shuttingDown = false;
let settings = null;
let lastActivity = null;

const defaultSettings = {
  clientId: "",
  autoConnect: true,
  accent: "#8175f5",
  activity: {
    name: "GafiPresence",
    type: "PLAYING",
    details: "Customising my Discord presence",
    state: "GafiPresence",
    largeImageKey: "",
    largeImageText: "",
    largeImagePath: "builtin:large/nebula.svg",
    smallImageKey: "",
    smallImageText: "",
    smallImagePath: "builtin:small/orbit.svg",
    timerMode: "elapsed",
    countdownMinutes: 60,
    elapsedSeconds: 0,
    buttons: [
      { label: "", url: "" },
      { label: "", url: "" }
    ]
  },
  presets: []
};

function dataDirectory() {
  return app.getPath("userData");
}

function settingsPath() {
  return path.join(dataDirectory(), "settings.json");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeSettings(saved) {
  const result = clone(defaultSettings);
  if (!saved || typeof saved !== "object") return result;
  result.clientId = typeof saved.clientId === "string" ? saved.clientId : "";
  result.autoConnect = saved.autoConnect !== false;
  result.accent = typeof saved.accent === "string" ? saved.accent : result.accent;
  result.activity = { ...result.activity, ...(saved.activity || {}) };
  result.activity.buttons = Array.isArray(saved.activity && saved.activity.buttons)
    ? saved.activity.buttons.slice(0, 2).map((button) => ({ label: String(button.label || ""), url: String(button.url || "") }))
    : result.activity.buttons;
  result.presets = Array.isArray(saved.presets) ? saved.presets.filter((item) => item && typeof item === "object") : [];
  return result;
}

function loadSettings() {
  try {
    settings = mergeSettings(JSON.parse(fs.readFileSync(settingsPath(), "utf8")));
  } catch {
    settings = clone(defaultSettings);
  }
}

function saveSettings() {
  fs.mkdirSync(dataDirectory(), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

function imageData(pathValue) {
  if (!pathValue || String(pathValue).startsWith("builtin:")) return null;
  try {
    const ext = path.extname(pathValue).toLowerCase();
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/png";
    const content = fs.readFileSync(pathValue);
    return "data:" + mime + ";base64," + content.toString("base64");
  } catch {
    return null;
  }
}

function publicState() {
  return {
    settings: clone(settings),
    status: {
      connected: rpcReady,
      connecting: rpcConnecting,
      clientIdPresent: Boolean(settings.clientId),
      clientId: settings.clientId
    },
    imageData: {
      large: imageData(settings.activity.largeImagePath),
      small: imageData(settings.activity.smallImagePath)
    }
  };
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function publishStatus() {
  send("presence:status", publicState().status);
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (shuttingDown || reconnectTimer || !settings.autoConnect || !settings.clientId) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectDiscord().catch(() => {});
  }, 12000);
  reconnectTimer.unref?.();
  publishStatus();
}

async function disconnectDiscord(clearActivity = false) {
  clearReconnectTimer();
  const client = rpcClient;
  rpcClient = null;
  rpcReady = false;
  rpcConnecting = false;
  publishStatus();
  if (client) {
    if (clearActivity) {
      try { await client.user?.clearActivity(); } catch {}
    }
    try { await client.destroy(); } catch {}
  }
}

async function connectDiscord() {
  if (shuttingDown) return { ok: false, message: "A aplicação está a fechar." };
  if (!settings.clientId || !/^\d{17,20}$/.test(settings.clientId)) {
    return { ok: false, message: "Introduz um Application ID válido nas Definições." };
  }
  if (rpcReady) return { ok: true, message: "Já ligado ao Discord." };
  if (rpcConnecting) return { ok: true, message: "Ligação em curso." };

  await disconnectDiscord(false);
  rpcConnecting = true;
  publishStatus();
  let client = null;

  try {
    const { Client } = await import("@xhayper/discord-rpc");
    if (shuttingDown) return { ok: false, message: "A aplicação está a fechar." };
    client = new Client({ clientId: settings.clientId });
    rpcClient = client;

    client.on("ready", () => {
      if (rpcClient !== client) return;
      rpcReady = true;
      rpcConnecting = false;
      publishStatus();
      if (lastActivity) applyActivity(lastActivity).catch(() => {});
    });

    client.on("disconnected", () => {
      if (rpcClient !== client) return;
      rpcClient = null;
      rpcReady = false;
      rpcConnecting = false;
      publishStatus();
      scheduleReconnect();
    });

    client.on("ERROR", () => {
      publishStatus();
    });

    await client.login();
    if (rpcClient === client && client.isConnected && !rpcReady) {
      rpcReady = true;
      rpcConnecting = false;
      publishStatus();
    }
    return { ok: true, message: "Pedido de ligação enviado ao Discord." };
  } catch (error) {
    if (rpcClient === client) rpcClient = null;
    rpcReady = false;
    rpcConnecting = false;
    await client?.destroy().catch(() => {});
    publishStatus();
    scheduleReconnect();
    return { ok: false, message: "Não foi possível ligar ao Discord: " + (error.message || String(error)) };
  }
}

function cleanText(value, maxLength = 128) {
  return String(value || "").trim().slice(0, maxLength);
}

function validButton(button) {
  const label = cleanText(button && button.label, 32);
  const url = cleanText(button && button.url, 512);
  if (!label && !url) return null;
  if (!label || !url) throw new Error("Cada botão precisa de ter um texto e um URL.");
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error("Um dos URLs dos botões não é válido."); }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Os botões só aceitam URLs HTTP ou HTTPS.");
  return { label, url };
}

function createActivity(source) {
  const activity = {
    name: cleanText(source.name, 128) || "GafiPresence",
    details: cleanText(source.details),
    state: cleanText(source.state)
  };
  const types = { PLAYING: 0, LISTENING: 2, WATCHING: 3, COMPETING: 5 };
  if (Object.prototype.hasOwnProperty.call(types, source.type)) activity.type = types[source.type];

  if (source.largeImageKey) activity.largeImageKey = cleanText(source.largeImageKey, 256);
  if (source.largeImageText) activity.largeImageText = cleanText(source.largeImageText);
  if (source.smallImageKey) activity.smallImageKey = cleanText(source.smallImageKey, 256);
  if (source.smallImageText) activity.smallImageText = cleanText(source.smallImageText);

  if (source.timerMode === "elapsed") {
    const elapsed = Math.max(0, Math.min(86400, Number(source.elapsedSeconds) || 0));
    activity.startTimestamp = new Date(Date.now() - elapsed * 1000);
  } else if (source.timerMode === "countdown") {
    const minutes = Math.max(1, Math.min(10080, Number(source.countdownMinutes) || 60));
    activity.endTimestamp = new Date(Date.now() + minutes * 60000);
  }

  const buttons = Array.isArray(source.buttons) ? source.buttons.slice(0, 2).map(validButton).filter(Boolean) : [];
  if (buttons.length) activity.buttons = buttons;
  return activity;
}

async function applyActivity(source) {
  if (!rpcReady || !rpcClient?.user) {
    const result = await connectDiscord();
    if (!result.ok) return result;
    if (!rpcReady || !rpcClient?.user) return { ok: false, message: "O Discord ainda está a estabelecer a ligação. Tenta novamente dentro de instantes." };
  }
  try {
    const activity = createActivity(source);
    lastActivity = source;
    await rpcClient.user.setActivity(activity);
    return { ok: true, message: "Rich Presence enviada para o Discord." };
  } catch (error) {
    return { ok: false, message: error.message || "Não foi possível atualizar a Rich Presence." };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 850,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: "#0b1020",
    title: "GafiPresence",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.webContents.once("did-finish-load", () => send("presence:initial", publicState()));
  mainWindow.on("closed", () => { mainWindow = null; });
}

ipcMain.handle("presence:get-state", () => publicState());

ipcMain.handle("presence:save-settings", async (_event, incoming) => {
  const previousId = settings.clientId;
  settings = mergeSettings(incoming);
  saveSettings();
  if (previousId !== settings.clientId) {
    await disconnectDiscord(false);
    if (settings.autoConnect) await connectDiscord();
  }
  return publicState();
});

ipcMain.handle("presence:connect", () => connectDiscord());
ipcMain.handle("presence:disconnect", async () => {
  await disconnectDiscord(true);
  return { ok: true, message: "Ligação RPC encerrada." };
});
ipcMain.handle("presence:apply", async (_event, activity) => applyActivity(activity));
ipcMain.handle("presence:clear", async () => {
  lastActivity = null;
  if (!rpcReady || !rpcClient?.user) return { ok: false, message: "Não existe uma ligação ativa ao Discord." };
  try {
    await rpcClient.user.clearActivity();
    return { ok: true, message: "Rich Presence removida." };
  } catch (error) {
    return { ok: false, message: error.message || "Não foi possível remover a presença." };
  }
});

ipcMain.handle("presence:pick-image", async (_event, kind) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: kind === "small" ? "Escolher Small Image" : "Escolher Large Image",
    properties: ["openFile"],
    filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const source = result.filePaths[0];
  const stat = fs.statSync(source);
  if (stat.size > 10 * 1024 * 1024) return { canceled: false, error: "A imagem é demasiado grande. O limite local é 10 MB." };
  const targetDirectory = path.join(dataDirectory(), "assets");
  fs.mkdirSync(targetDirectory, { recursive: true });
  const ext = path.extname(source).toLowerCase();
  const safeName = (kind === "small" ? "small-" : "large-") + Date.now() + ext;
  const target = path.join(targetDirectory, safeName);
  fs.copyFileSync(source, target);
  return { canceled: false, path: target, dataUrl: imageData(target), name: path.basename(source) };
});

ipcMain.handle("presence:load-image", (_event, imagePath) => imageData(imagePath));

ipcMain.handle("presence:save-preset", (_event, preset) => {
  const name = cleanText(preset && preset.name, 48);
  if (!name) return { ok: false, message: "Escolhe um nome para o preset." };
  const id = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 7);
  settings.presets.push({ id, name, activity: preset.activity });
  saveSettings();
  return { ok: true, presets: settings.presets };
});

ipcMain.handle("presence:delete-preset", (_event, id) => {
  settings.presets = settings.presets.filter((preset) => preset.id !== id);
  saveSettings();
  return { ok: true, presets: settings.presets };
});

ipcMain.handle("presence:export", async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Exportar configurações GafiPresence",
    defaultPath: "gafipresence-config.json",
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  fs.writeFileSync(result.filePath, JSON.stringify(settings, null, 2), "utf8");
  return { ok: true, path: result.filePath };
});

ipcMain.handle("presence:import", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Importar configurações GafiPresence",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  try {
    const imported = JSON.parse(fs.readFileSync(result.filePaths[0], "utf8"));
    settings = mergeSettings(imported);
    saveSettings();
    await disconnectDiscord(false);
    if (settings.autoConnect && settings.clientId) await connectDiscord();
    return { ok: true, state: publicState() };
  } catch (error) {
    return { ok: false, message: "O ficheiro não contém uma configuração válida: " + error.message };
  }
});

ipcMain.handle("presence:open-developer-portal", () => shell.openExternal("https://discord.com/developers/applications"));

app.whenReady().then(() => {
  app.setAppUserModelId(APP_ID);
  loadSettings();
  createWindow();
  if (settings.autoConnect && settings.clientId) connectDiscord().catch(() => {});
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("before-quit", async () => {
  shuttingDown = true;
  clearReconnectTimer();
  await disconnectDiscord(true);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
