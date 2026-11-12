const { app, BrowserWindow, ipcMain, clipboard } = require("electron");
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const MAX_LOG_ENTRIES = 4000;
const logs = [];
let mainWindow = null;
let botProcess = null;
let stopPromise = null;
let stopRequested = false;
let projectRoot = null;
let isQuitting = false;
let rpcClient = null;
let rpcReady = false;
let rpcConnecting = false;
let rpcRetryTimer = null;
let presenceUpdateTimer = null;
let botStartedAt = null;
let botOnline = false;

app.setAppUserModelId("com.gafipro.gafispeak.manager");

function addLog(level, message) {
  const safeMessage = String(message)
    .replace(/(DISCORD_TOKEN\s*=\s*)\S+/gi, "$1[REDACTED]")
    .replace(/(authorization:\s*bot\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]");
  const entry = {
    time: new Date().toLocaleTimeString("pt-PT", { hour12: false }),
    level,
    message: safeMessage
  };
  logs.push(entry);
  if (safeMessage.includes("[GafiSpeak] Logged in as ")) {
    botOnline = true;
    queueRichPresenceUpdate();
  }
  if (logs.length > MAX_LOG_ENTRIES) logs.splice(0, logs.length - MAX_LOG_ENTRIES);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("manager:log", entry);
}

function isGafiSpeakRoot(candidate) {
  return fs.existsSync(path.join(candidate, "src", "index.js")) &&
    fs.existsSync(path.join(candidate, "package.json"));
}

function findProjectRoot() {
  const hints = [];
  if (process.env.PORTABLE_EXECUTABLE_DIR) hints.push(process.env.PORTABLE_EXECUTABLE_DIR);
  if (!app.isPackaged) hints.push(path.resolve(__dirname, ".."));
  try { hints.push(path.dirname(app.getPath("exe"))); } catch {}

  for (const hint of hints) {
    let current = path.resolve(hint);
    for (let depth = 0; depth < 9; depth += 1) {
      if (isGafiSpeakRoot(current)) return current;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

function getNodeExecutable() {
  const candidates = [
    projectRoot ? path.join(projectRoot, ".runtime", "node", "node.exe") : null,
    process.env.GAFISPEAK_NODE,
    process.env.NODE_HOME ? path.join(process.env.NODE_HOME, "node.exe") : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "nodejs", "node.exe") : null,
    process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"], "nodejs", "node.exe") : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "nodejs", "node.exe") : null
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return candidate;
  }
  return process.platform === "win32" ? "node.exe" : "node";
}

function getProjectChecks() {
  if (!projectRoot) return ["Não encontrei a pasta do GafiSpeak. Coloca este executável dentro da pasta do projeto."];
  const problems = [];
  if (!fs.existsSync(path.join(projectRoot, ".env"))) problems.push("Falta o ficheiro .env.");
  if (!fs.existsSync(path.join(projectRoot, "node_modules"))) problems.push("Falta a pasta node_modules. As dependências Node ainda não estão instaladas.");
  if (!fs.existsSync(path.join(projectRoot, "src", "index.js"))) problems.push("Não encontrei src/index.js.");
  return problems;
}

function getStatus() {
  return {
    running: Boolean(botProcess && botProcess.exitCode === null),
    stopping: stopRequested,
    rootFound: Boolean(projectRoot),
    rootPath: projectRoot,
    ready: getProjectChecks().length === 0,
    presenceStatus: rpcReady ? "connected" : (rpcConnecting || rpcRetryTimer ? "connecting" : "offline")
  };
}

function readDiscordClientId() {
  if (!projectRoot) return null;
  try {
    const envText = fs.readFileSync(path.join(projectRoot, ".env"), "utf8");
    const match = envText.match(/^\s*(?:export\s+)?CLIENT_ID\s*=\s*["']?(\d{17,20})["']?(?:\s*#.*)?\s*$/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function scheduleRichPresenceReconnect(delay = 15000) {
  if (isQuitting || rpcRetryTimer) return;
  rpcRetryTimer = setTimeout(() => {
    rpcRetryTimer = null;
    void connectRichPresence();
    broadcastStatus();
  }, delay);
  rpcRetryTimer.unref?.();
  broadcastStatus();
}

function buildRichPresenceActivity() {
  const running = Boolean(botProcess && botProcess.exitCode === null);
  const state = !running
    ? "Manager open · ready to start"
    : stopRequested
      ? "Stopping the bot..."
      : botOnline
        ? "Online · Kokoro TTS"
        : "Connecting to Discord...";

  const activity = {
    name: "GafiSpeak",
    details: running ? "Giving messages a voice" : "Managing GafiSpeak",
    state,
    buttons: [
      { label: "GitHub", url: "https://github.com/GafiPro/GafiSpeak" },
      { label: "Kokoro TTS", url: "https://huggingface.co/hexgrad/Kokoro-82M" }
    ]
  };

  if (running && botStartedAt) activity.startTimestamp = new Date(botStartedAt);
  return activity;
}

function queueRichPresenceUpdate() {
  if (!rpcReady || presenceUpdateTimer) return;
  presenceUpdateTimer = setTimeout(() => {
    presenceUpdateTimer = null;
    void updateRichPresence();
  }, 700);
  presenceUpdateTimer.unref?.();
}

async function updateRichPresence() {
  if (!rpcReady || !rpcClient?.user) return;
  try {
    await rpcClient.user.setActivity(buildRichPresenceActivity());
  } catch (error) {
    const failedClient = rpcClient;
    rpcClient = null;
    rpcReady = false;
    addLog("AVISO", "A Rich Presence deixou de atualizar: " + (error?.message || String(error)));
    await failedClient?.destroy().catch(() => {});
    scheduleRichPresenceReconnect();
    broadcastStatus();
  }
}

async function connectRichPresence() {
  if (rpcConnecting || rpcReady || isQuitting || !projectRoot) return;
  const clientId = readDiscordClientId();
  if (!clientId) {
    addLog("AVISO", "Rich Presence indisponível: não encontrei um CLIENT_ID válido no .env.");
    broadcastStatus();
    return;
  }

  rpcConnecting = true;
  broadcastStatus();
  let client = null;

  try {
    const { Client } = await import("@xhayper/discord-rpc");
    if (isQuitting) return;

    client = new Client({ clientId });
    rpcClient = client;

    client.on("ready", () => {
      if (rpcClient !== client) return;
      rpcReady = true;
      addLog("INFO", "Discord Rich Presence ligada.");
      queueRichPresenceUpdate();
      broadcastStatus();
    });

    client.on("disconnected", () => {
      if (rpcClient !== client) return;
      rpcClient = null;
      rpcReady = false;
      if (!isQuitting) {
        addLog("AVISO", "A ligação Rich Presence foi interrompida. Vou tentar novamente em 15 segundos.");
        scheduleRichPresenceReconnect();
      }
      broadcastStatus();
    });

    client.on("ERROR", (data) => {
      const message = data?.message || "O Discord devolveu um erro RPC.";
      addLog("AVISO", "Discord RPC: " + message);
    });

    await client.login();
    if (rpcClient === client && client.isConnected && !rpcReady) {
      rpcReady = true;
      addLog("INFO", "Discord Rich Presence ligada.");
      queueRichPresenceUpdate();
    }
  } catch (error) {
    if (rpcClient === client) rpcClient = null;
    rpcReady = false;
    await client?.destroy().catch(() => {});
    if (!isQuitting) {
      addLog("AVISO", "Discord não detetado para a Rich Presence: " + (error?.message || String(error)));
      scheduleRichPresenceReconnect();
    }
  } finally {
    rpcConnecting = false;
    broadcastStatus();
  }
}

async function stopRichPresence() {
  if (rpcRetryTimer) {
    clearTimeout(rpcRetryTimer);
    rpcRetryTimer = null;
  }
  if (presenceUpdateTimer) {
    clearTimeout(presenceUpdateTimer);
    presenceUpdateTimer = null;
  }

  const client = rpcClient;
  rpcClient = null;
  rpcReady = false;
  rpcConnecting = false;
  broadcastStatus();

  if (client) {
    try { await client.user?.clearActivity(); } catch {}
    try { await client.destroy(); } catch {}
  }
}

function broadcastStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("manager:status", getStatus());
}

function attachLogStream(stream, level) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || "";
    for (const line of lines) if (line.trim()) addLog(level, line);
  });
  stream.on("end", () => {
    if (pending.trim()) addLog(level, pending);
  });
}

function startBot() {
  if (botProcess && botProcess.exitCode === null) return { ok: false, message: "O GafiSpeak já está em execução." };
  projectRoot = projectRoot || findProjectRoot();
  const problems = getProjectChecks();
  if (problems.length) {
    for (const problem of problems) addLog("ERRO", problem);
    broadcastStatus();
    return { ok: false, message: problems.join(" ") };
  }

  const nodeExecutable = getNodeExecutable();
  addLog("INFO", "A iniciar o GafiSpeak...");
  addLog("INFO", "Pasta do projeto: " + projectRoot);
  addLog("INFO", "A executar src/index.js com " + nodeExecutable);

  try {
    const child = spawn(nodeExecutable, ["src/index.js"], {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0" }
    });
    botProcess = child;
    stopRequested = false;
    botOnline = false;
    botStartedAt = null;
    attachLogStream(child.stdout, "BOT");
    attachLogStream(child.stderr, "AVISO");

    child.once("spawn", () => {
      botStartedAt = Date.now();
      addLog("INFO", "Processo iniciado. O bot está a ligar-se ao Discord.");
      queueRichPresenceUpdate();
      broadcastStatus();
    });
    child.once("error", (error) => {
      addLog("ERRO", "Não foi possível iniciar o Node.js: " + error.message);
      if (botProcess === child) botProcess = null;
      botStartedAt = null;
      botOnline = false;
      stopRequested = false;
      queueRichPresenceUpdate();
      broadcastStatus();
    });
    child.once("exit", (code, signal) => {
      if (botProcess === child) botProcess = null;
      botStartedAt = null;
      botOnline = false;
      if (stopRequested || code === 0) addLog("INFO", "GafiSpeak parado.");
      else addLog("ERRO", "O processo terminou (código " + code + ", sinal " + signal + ").");
      stopRequested = false;
      queueRichPresenceUpdate();
      broadcastStatus();
    });
    broadcastStatus();
    return { ok: true, message: "A iniciar o GafiSpeak." };
  } catch (error) {
    botProcess = null;
    stopRequested = false;
    addLog("ERRO", "Falha ao iniciar o processo: " + error.message);
    broadcastStatus();
    return { ok: false, message: error.message };
  }
}

function forceStopProcess(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    if (process.platform === "win32" && child.pid) {
      execFile("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], (error) => {
        if (error && child.exitCode === null) child.kill();
        resolve();
      });
    } else {
      child.kill("SIGKILL");
      resolve();
    }
  });
}

function stopBot() {
  if (stopPromise) return stopPromise;
  const child = botProcess;
  if (!child || child.exitCode !== null) {
    botProcess = null;
    stopRequested = false;
    broadcastStatus();
    return Promise.resolve({ ok: true, message: "O GafiSpeak já está parado." });
  }

  stopRequested = true;
  addLog("INFO", "A pedir ao bot para encerrar de forma segura...");
  queueRichPresenceUpdate();
  broadcastStatus();

  stopPromise = new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(forceTimer);
      stopRequested = false;
      stopPromise = null;
      broadcastStatus();
      resolve({ ok: true, message: "GafiSpeak parado." });
    };
    child.once("exit", finish);
    const forceTimer = setTimeout(() => {
      if (child.exitCode === null) {
        addLog("AVISO", "O bot demorou a encerrar. A terminar os processos restantes...");
        void forceStopProcess(child);
      }
    }, 12000);

    try {
      if (!child.stdin.destroyed && child.stdin.writable) {
        child.stdin.write("GAFISPEAK_MANAGER_STOP\n", (error) => {
          if (error) addLog("AVISO", "Não foi possível enviar o pedido de encerramento: " + error.message);
        });
      } else {
        void forceStopProcess(child);
      }
    } catch (error) {
      addLog("AVISO", "Falha ao enviar o pedido de encerramento: " + error.message);
      void forceStopProcess(child);
    }
  });
  return stopPromise;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 780,
    minHeight: 560,
    title: "GafiSpeak Manager",
    icon: path.join(__dirname, "build", "icon.ico"),
    backgroundColor: "#0b1020",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenu(null);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.webContents.send("manager:initial-state", { status: getStatus(), logs });
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

ipcMain.handle("manager:get-state", () => ({ status: getStatus(), logs }));
ipcMain.handle("manager:start", () => startBot());
ipcMain.handle("manager:stop", () => stopBot());
ipcMain.handle("manager:clear-logs", () => {
  logs.length = 0;
  addLog("INFO", "Registo limpo.");
  return true;
});
ipcMain.handle("manager:copy-logs", () => {
  const content = logs.map((entry) => "[" + entry.time + "] [" + entry.level + "] " + entry.message).join("\n");
  clipboard.writeText(content || "O registo está vazio.");
  return true;
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    projectRoot = findProjectRoot();
    addLog("INFO", "GafiSpeak Manager iniciado.");
    if (projectRoot) {
      addLog("INFO", "Pasta do projeto encontrada: " + projectRoot);
      for (const problem of getProjectChecks()) addLog("AVISO", problem);
      if (fs.existsSync(path.join(projectRoot, ".venv", "Scripts", "python.exe"))) {
        addLog("INFO", "Ambiente Python local encontrado.");
      } else {
        addLog("AVISO", "Não encontrei .venv. O bot tentará usar o Python configurado no sistema.");
      }
    } else {
      addLog("AVISO", "Coloca GafiSpeak Manager.exe na pasta principal do GafiSpeak, ao lado de .env e package.json.");
    }
    createWindow();
    void connectRichPresence();
  });
}

app.on("before-quit", (event) => {
  if (isQuitting) return;
  const botIsRunning = Boolean(botProcess && botProcess.exitCode === null);
  const hasPresenceWork = Boolean(rpcClient || rpcRetryTimer || rpcConnecting);
  if (!botIsRunning && !hasPresenceWork) return;

  event.preventDefault();
  isQuitting = true;
  addLog("INFO", "A fechar a aplicação e a limpar a Rich Presence...");
  void stopBot().finally(async () => {
    await stopRichPresence();
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
