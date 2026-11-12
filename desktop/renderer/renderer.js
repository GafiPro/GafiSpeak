const api = window.gafiSpeakManager;
const startButton = document.getElementById("start-button");
const stopButton = document.getElementById("stop-button");
const copyButton = document.getElementById("copy-button");
const clearButton = document.getElementById("clear-button");
const terminal = document.getElementById("terminal");
const terminalEmpty = document.getElementById("terminal-empty");
const logCount = document.getElementById("log-count");
const statusValue = document.getElementById("status-value");
const statusSubtitle = document.getElementById("status-subtitle");
const statusIndicator = document.getElementById("status-indicator");
const folderPath = document.getElementById("folder-path");
const rpcTag = document.getElementById("rpc-tag");
const rpcStatus = document.getElementById("rpc-status");
const toast = document.getElementById("toast");

let entries = [];
let status = { running: false, stopping: false, rootFound: false, ready: false, rootPath: null };
let toastTimer = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2200);
}

function addEntry(entry) {
  const wasNearBottom = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 45;
  entries.push(entry);
  if (entries.length > 4000) entries = entries.slice(-4000);
  renderLogs(wasNearBottom);
}

function renderLogs(scrollToBottom) {
  terminal.replaceChildren();
  if (!entries.length) {
    terminal.appendChild(terminalEmpty);
    terminalEmpty.style.display = "block";
  } else {
    terminalEmpty.style.display = "none";
    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
      const line = document.createElement("div");
      line.className = "log-line";
      const time = document.createElement("span");
      time.className = "log-time";
      time.textContent = "[" + entry.time + "] ";
      const level = document.createElement("span");
      level.className = "log-level level-" + entry.level;
      level.textContent = "[" + entry.level + "]";
      const message = document.createElement("span");
      message.textContent = " " + entry.message;
      line.append(time, level, message);
      fragment.appendChild(line);
    }
    terminal.appendChild(fragment);
  }
  logCount.textContent = entries.length + (entries.length === 1 ? " linha" : " linhas");
  if (scrollToBottom) terminal.scrollTop = terminal.scrollHeight;
}

function renderStatus(nextStatus) {
  status = nextStatus;
  const running = Boolean(status.running);
  const stopping = Boolean(status.stopping);
  startButton.disabled = running || !status.ready || stopping;
  stopButton.disabled = !running || stopping;
  statusIndicator.className = "status-indicator" + (stopping ? " stopping" : running ? " running" : "");
  if (stopping) {
    statusValue.textContent = "A parar...";
    statusSubtitle.textContent = "A encerrar a ligação e os processos";
  } else if (running) {
    statusValue.textContent = "Em execução";
    statusSubtitle.textContent = "O bot está ativo em segundo plano";
  } else if (status.ready) {
    statusValue.textContent = "Parado";
    statusSubtitle.textContent = "Pronto para iniciar";
  } else {
    statusValue.textContent = "Configuração incompleta";
    statusIndicator.classList.add("error");
    statusSubtitle.textContent = "Verifica a pasta e os ficheiros do projeto";
  }
  folderPath.textContent = status.rootPath || "Pasta do GafiSpeak não encontrada";
  folderPath.title = status.rootPath || "";

  const presenceStatus = status.presenceStatus || "offline";
  rpcTag.className = "rpc-tag" + (presenceStatus === "connected" ? " connected" : presenceStatus === "connecting" ? " connecting" : "");
  rpcStatus.textContent = presenceStatus === "connected"
    ? "Rich Presence ativa"
    : presenceStatus === "connecting"
      ? "A ligar ao Discord..."
      : "Discord não detetado";
}

function renderInitialState(data) {
  entries = Array.isArray(data.logs) ? data.logs : [];
  renderStatus(data.status);
  renderLogs(true);
}

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  const result = await api.start();
  if (!result.ok) showToast(result.message || "Não foi possível iniciar.");
});
stopButton.addEventListener("click", async () => {
  stopButton.disabled = true;
  const result = await api.stop();
  if (!result.ok) showToast(result.message || "Não foi possível parar.");
});
copyButton.addEventListener("click", async () => {
  await api.copyLogs();
  showToast("Log copiado. Já o podes colar na conversa.");
});
clearButton.addEventListener("click", async () => {
  await api.clearLogs();
  entries = [];
  renderLogs(true);
  showToast("Registo limpo.");
});

api.onInitialState(renderInitialState);
api.onLog(addEntry);
api.onStatus(renderStatus);
api.getState().then(renderInitialState).catch((error) => {
  addEntry({ time: "--:--:--", level: "ERRO", message: error.message });
});
