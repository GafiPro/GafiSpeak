const api = window.gafiPresence;
const defaultPresets = [
  { id: "starter-gaming", name: "Nebula Gaming", description: "Um visual roxo para sessões de jogo.", activity: { name: "GafiPresence", type: "PLAYING", details: "A jogar Rocket League", state: "Ranked 2v2 · Grinding", largeImageKey: "", largeImageText: "Nebula Gaming", largeImagePath: "builtin:large/nebula.svg", smallImageKey: "", smallImageText: "Online", smallImagePath: "builtin:small/orbit.svg", timerMode: "elapsed", elapsedSeconds: 0, countdownMinutes: 60, buttons: [{label:"",url:""},{label:"",url:""}] } },
  { id: "starter-coding", name: "Developer Mode", description: "Uma presença minimalista para programar.", activity: { name: "GafiPresence", type: "PLAYING", details: "A escrever código", state: "A construir algo novo", largeImageKey: "", largeImageText: "Developer Mode", largeImagePath: "builtin:large/grid.svg", smallImageKey: "", smallImageText: "Coding", smallImagePath: "builtin:small/code.svg", timerMode: "elapsed", elapsedSeconds: 0, countdownMinutes: 60, buttons: [{label:"",url:""},{label:"",url:""}] } },
  { id: "starter-music", name: "After Hours", description: "Gradientes e ondas para ouvir música.", activity: { name: "GafiPresence", type: "LISTENING", details: "A ouvir música", state: "After Hours", largeImageKey: "", largeImageText: "After Hours", largeImagePath: "builtin:large/waves.svg", smallImageKey: "", smallImageText: "Listening", smallImagePath: "builtin:small/music.svg", timerMode: "elapsed", elapsedSeconds: 0, countdownMinutes: 60, buttons: [{label:"",url:""},{label:"",url:""}] } },
  { id: "starter-aurora", name: "Aurora", description: "Um fundo abstrato mais calmo e luminoso.", activity: { name: "GafiPresence", type: "WATCHING", details: "A desfrutar do momento", state: "Sem pressa.", largeImageKey: "", largeImageText: "Aurora", largeImagePath: "builtin:large/aurora.svg", smallImageKey: "", smallImageText: "Online", smallImagePath: "builtin:small/orbit.svg", timerMode: "none", elapsedSeconds: 0, countdownMinutes: 60, buttons: [{label:"",url:""},{label:"",url:""}] } }
];

let settings = null;
let rpcStatus = { connected: false, connecting: false, clientIdPresent: false };
let imageData = { large: null, small: null };
let toastTimer = null;
const appStartedAt = Date.now();
let timerStartedAt = Date.now();
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
function getPath(object, path) { return path.split(".").reduce((value, key) => value == null ? undefined : value[key], object); }
function setPath(object, path, value) {
  const keys = path.split(".");
  let target = object;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (target[key] == null) target[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    target = target[key];
  }
  target[keys[keys.length - 1]] = value;
}
function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}
function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours + ":" + minutes + ":" + remainder;
}
function withVariables(value) {
  const now = new Date();
  const uptime = formatDuration((Date.now() - appStartedAt) / 1000);
  return String(value || "")
    .replaceAll("{time}", now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }))
    .replaceAll("{date}", now.toLocaleDateString("pt-PT"))
    .replaceAll("{uptime}", uptime);
}
function currentActivity() {
  const activity = deepClone(settings.activity);
  activity.name = withVariables(activity.name);
  activity.details = withVariables(activity.details);
  activity.state = withVariables(activity.state);
  activity.largeImageText = withVariables(activity.largeImageText);
  activity.smallImageText = withVariables(activity.smallImageText);
  return activity;
}
function setFieldValues() {
  $$("[data-field]").forEach((field) => {
    const value = getPath(settings, field.dataset.field);
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value == null ? "" : String(value);
  });
  $("#auto-connect").checked = settings.autoConnect !== false;
  $("#accent-color").value = settings.accent || "#8175f5";
  $("#accent-value").textContent = (settings.accent || "#8175f5").toUpperCase();
  $$("#timer-segment button").forEach((button) => button.classList.toggle("selected", button.dataset.timer === settings.activity.timerMode));
  $("#timer-extra").classList.toggle("hidden", settings.activity.timerMode === "none");
  $("#countdown-field").style.display = settings.activity.timerMode === "countdown" ? "flex" : "none";
}
function previewImage(pathValue, kind) {
  if (kind === "large" && imageData.large && pathValue && !pathValue.startsWith("builtin:")) return imageData.large;
  if (kind === "small" && imageData.small && pathValue && !pathValue.startsWith("builtin:")) return imageData.small;
  const path = String(pathValue || "");
  if (path.startsWith("builtin:")) return "../assets/presets/" + path.slice(8);
  return kind === "large" ? "../assets/presets/large/nebula.svg" : "../assets/presets/small/orbit.svg";
}
function renderPreview() {
  if (!settings) return;
  const activity = settings.activity;
  $("#preview-name").textContent = withVariables(activity.name) || "GafiPresence";
  $("#preview-details").textContent = withVariables(activity.details) || "Sem detalhes";
  $("#preview-state").textContent = withVariables(activity.state) || "Sem estado";
  $("#preview-large").src = previewImage(activity.largeImagePath, "large");
  $("#preview-small").src = previewImage(activity.smallImagePath, "small");
  $("#large-thumb").innerHTML = '<img src="' + previewImage(activity.largeImagePath, "large") + '" alt="">';
  $("#small-thumb").innerHTML = '<img src="' + previewImage(activity.smallImagePath, "small") + '" alt="">';
  const timer = $("#preview-timer");
  if (activity.timerMode === "elapsed") {
    timer.textContent = formatDuration(Number(activity.elapsedSeconds || 0) + (Date.now() - timerStartedAt) / 1000) + " decorrido";
    timer.style.display = "block";
  } else if (activity.timerMode === "countdown") {
    timer.textContent = formatDuration(Math.max(0, Number(activity.countdownMinutes || 60) * 60 - (Date.now() - timerStartedAt) / 1000)) + " restante";
    timer.style.display = "block";
  } else {
    timer.style.display = "none";
  }
  const buttonHost = $("#preview-buttons");
  buttonHost.replaceChildren();
  (activity.buttons || []).slice(0, 2).forEach((button) => {
    if (!button.label || !button.url) return;
    const element = document.createElement("div");
    element.className = "preview-button";
    element.textContent = button.label;
    buttonHost.appendChild(element);
  });
  const count = (activity.buttons || []).filter((button) => button.label || button.url).length;
  $(".limit-pill").textContent = count + " / 2";
}
function renderStatus() {
  const pill = $("#status-pill");
  const dot = $("#side-dot");
  const label = $("#status-label");
  if (rpcStatus.connected) {
    pill.classList.add("connected");
    dot.classList.add("connected");
    label.textContent = "Ligado ao Discord";
    $("#side-connection").textContent = "Discord ligado";
    $("#side-note").textContent = "A tua presença pode ser atualizada.";
    $("#side-connect").textContent = "Ligação ativa";
  } else if (rpcStatus.connecting) {
    pill.classList.remove("connected");
    dot.classList.remove("connected");
    label.textContent = "A ligar ao Discord...";
    $("#side-connection").textContent = "A ligar...";
    $("#side-note").textContent = "A aguardar resposta do cliente Discord.";
    $("#side-connect").textContent = "A ligar...";
  } else {
    pill.classList.remove("connected");
    dot.classList.remove("connected");
    label.textContent = rpcStatus.clientIdPresent ? "Discord desligado" : "A aguardar configuração";
    $("#side-connection").textContent = rpcStatus.clientIdPresent ? "Desligado" : "Configuração necessária";
    $("#side-note").textContent = rpcStatus.clientIdPresent ? "Abre o Discord e tenta ligar." : "Adiciona o Application ID nas definições.";
    $("#side-connect").textContent = "Ligar ao Discord";
  }
}
function showPage(name) {
  $$(".page").forEach((page) => page.classList.toggle("active", page.id === "page-" + name));
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.tab === name));
  const titles = { editor: ["EDITOR", "Editor de presença"], presets: ["PRESETS", "Biblioteca de presets"], assets: ["ASSETS", "Galeria de imagens"], settings: ["DEFINIÇÕES", "Definições gerais"] };
  $("#crumb-current").textContent = titles[name][0];
  $("#page-heading").textContent = titles[name][1];
  if (name === "presets") renderPresets();
  if (name === "assets") renderAssets();
}
function renderPresets() {
  const host = $("#preset-grid");
  host.replaceChildren();
  const presets = (settings.presets || []).concat(defaultPresets);
  $("#preset-empty").classList.toggle("visible", presets.length === 0);
  presets.forEach((preset) => {
    const large = preset.activity && preset.activity.largeImagePath || "builtin:large/nebula.svg";
    const src = large.startsWith("builtin:") ? "../assets/presets/" + large.slice(8) : "../assets/presets/large/nebula.svg";
    const card = document.createElement("article");
    card.className = "preset-card";
    const cover = document.createElement("div");
    cover.className = "preset-cover";
    cover.style.backgroundImage = "url('" + src + "')";
    const body = document.createElement("div");
    body.className = "preset-content";
    const title = document.createElement("div");
    title.className = "preset-name";
    title.textContent = preset.name;
    const desc = document.createElement("div");
    desc.className = "preset-desc";
    desc.textContent = preset.description || (preset.activity && preset.activity.details) || "Preset personalizado";
    const actions = document.createElement("div");
    actions.className = "preset-actions";
    const load = document.createElement("button");
    load.className = "button button-secondary";
    load.textContent = "Carregar";
    load.addEventListener("click", async () => {
      settings.activity = { ...settings.activity, ...deepClone(preset.activity), buttons: deepClone(preset.activity.buttons || settings.activity.buttons) };
      timerStartedAt = Date.now();
      imageData.large = await api.loadImage(settings.activity.largeImagePath);
      imageData.small = await api.loadImage(settings.activity.smallImagePath);
      setFieldValues(); renderPreview(); showPage("editor"); notify("Preset carregado no editor.");
    });
    actions.appendChild(load);
    if (!String(preset.id).startsWith("starter-")) {
      const remove = document.createElement("button");
      remove.className = "button button-quiet";
      remove.textContent = "Eliminar";
      remove.addEventListener("click", async () => {
        const result = await api.deletePreset(preset.id);
        settings.presets = result.presets || [];
        renderPresets();
        notify("Preset eliminado.");
      });
      actions.appendChild(remove);
    }
    body.append(title, desc, actions);
    card.append(cover, body);
    host.appendChild(card);
  });
}
const largeAssets = [
  ["Nebula","large/nebula.svg"],["Grid","large/grid.svg"],["Waves","large/waves.svg"],["Aurora","large/aurora.svg"],["Circuit","large/circuit.svg"]
];
const smallAssets = [
  ["Orbit","small/orbit.svg"],["Code","small/code.svg"],["Controller","small/controller.svg"],["Music","small/music.svg"]
];
function renderGallery(hostSelector, assets, kind) {
  const host = $(hostSelector);
  host.replaceChildren();
  assets.forEach(([label, file]) => {
    const button = document.createElement("button");
    button.className = "asset-card";
    const image = document.createElement("img");
    image.src = "../assets/presets/" + file;
    image.alt = label;
    const caption = document.createElement("span");
    caption.textContent = label;
    button.append(image, caption);
    button.addEventListener("click", () => {
      settings.activity[kind + "ImagePath"] = "builtin:" + file;
      imageData[kind] = null;
      const keyField = $('[data-field="activity.' + kind + 'ImageKey"]');
      if (!keyField.value) keyField.value = "";
      renderPreview();
      notify(label + " selecionado para " + (kind === "large" ? "Large Image" : "Small Image") + ".");
    });
    host.appendChild(button);
  });
}
function renderAssets() {
  renderGallery("#large-gallery", largeAssets, "large");
  renderGallery("#small-gallery", smallAssets, "small");
  const host = $("#uploaded-assets");
  host.replaceChildren();
  ["large", "small"].forEach((kind) => {
    const path = settings.activity[kind + "ImagePath"];
    if (!path || path.startsWith("builtin:")) return;
    const chip = document.createElement("div");
    chip.className = "uploaded-chip";
    const img = document.createElement("img");
    img.src = imageData[kind] || "";
    const label = document.createElement("span");
    label.textContent = (kind === "large" ? "Large" : "Small") + " · " + path.split(/[\\/]/).pop();
    chip.append(img, label);
    host.appendChild(chip);
  });
}
async function pickImage(kind) {
  const result = await api.pickImage(kind);
  if (result.canceled) return;
  if (result.error) { notify(result.error); return; }
  settings.activity[kind + "ImagePath"] = result.path;
  imageData[kind] = result.dataUrl;
  await persistSettings(false);
  renderPreview();
  if ($("#page-assets").classList.contains("active")) renderAssets();
  notify("Imagem carregada para a pré-visualização.");
}
async function persistSettings(reconnect = true) {
  settings.autoConnect = $("#auto-connect").checked;
  settings.accent = $("#accent-color").value;
  const result = await api.saveSettings(settings);
  settings = result.settings;
  imageData = result.imageData || imageData;
  rpcStatus = result.status;
  renderStatus();
  return result;
}
async function savePreset() {
  const name = window.prompt("Nome para este preset:");
  if (!name || !name.trim()) return;
  const result = await api.savePreset({ name: name.trim(), activity: deepClone(settings.activity) });
  if (!result.ok) { notify(result.message); return; }
  settings.presets = result.presets || [];
  notify("Preset guardado.");
  renderPresets();
}
function bindFields() {
  $$("[data-field]").forEach((field) => {
    const eventName = field.tagName === "SELECT" || field.type === "checkbox" || field.type === "number" ? "change" : "input";
    field.addEventListener(eventName, () => {
      let value = field.type === "checkbox" ? field.checked : field.type === "number" ? Number(field.value) : field.value;
      setPath(settings, field.dataset.field, value);
      renderPreview();
    });
  });
}
function initEvents() {
  $$(".nav-item").forEach((item) => item.addEventListener("click", () => showPage(item.dataset.tab)));
  $$("[data-open-tab]").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.openTab)));
  $$("[data-pick]").forEach((button) => button.addEventListener("click", () => pickImage(button.dataset.pick)));
  $$("#timer-segment button").forEach((button) => button.addEventListener("click", () => {
    settings.activity.timerMode = button.dataset.timer;
    setFieldValues(); renderPreview();
  }));
  $("#apply-button").addEventListener("click", async () => {
    await persistSettings();
    timerStartedAt = Date.now();
    renderPreview();
    const result = await api.apply(currentActivity());
    notify(result.message);
  });
  $("#clear-button").addEventListener("click", async () => {
    const result = await api.clear();
    notify(result.message);
  });
  $("#side-connect").addEventListener("click", async () => {
    if (!settings.clientId) { showPage("settings"); notify("Primeiro adiciona o Application ID."); return; }
    const result = await api.connect();
    notify(result.message);
  });
  $("#save-preset-button").addEventListener("click", savePreset);
  $("#save-preset-page").addEventListener("click", savePreset);
  $("#save-settings-button").addEventListener("click", async () => {
    const result = await persistSettings();
    if (settings.autoConnect && settings.clientId) {
      const connection = await api.connect();
      notify(connection.message);
    } else notify("Definições guardadas.");
  });
  $("#disconnect-button").addEventListener("click", async () => {
    const result = await api.disconnect();
    notify(result.message);
  });
  $("#accent-color").addEventListener("input", (event) => {
    settings.accent = event.target.value;
    document.documentElement.style.setProperty("--accent", settings.accent);
    document.documentElement.style.setProperty("--accent-soft", settings.accent + "24");
    $("#accent-value").textContent = settings.accent.toUpperCase();
  });
  $("#export-button").addEventListener("click", async () => {
    await persistSettings(false);
    const result = await api.exportConfig();
    if (result.ok) notify("Configuração exportada.");
  });
  $("#import-button").addEventListener("click", async () => {
    const result = await api.importConfig();
    if (result.canceled) return;
    if (!result.ok) { notify(result.message); return; }
    settings = result.state.settings; imageData = result.state.imageData; rpcStatus = result.state.status; timerStartedAt = Date.now();
    setFieldValues(); renderPreview(); renderStatus(); renderPresets();
    notify("Configuração importada.");
  });
  $("#open-portal-button").addEventListener("click", () => api.openDeveloperPortal());
  $("#portal-link").addEventListener("click", () => api.openDeveloperPortal());
}
function applyAppearance() {
  document.documentElement.style.setProperty("--accent", settings.accent || "#8175f5");
  document.documentElement.style.setProperty("--accent-soft", (settings.accent || "#8175f5") + "24");
}
async function init() {
  const state = await api.getState();
  settings = state.settings;
  rpcStatus = state.status;
  imageData = state.imageData || imageData;
  applyAppearance();
  bindFields();
  setFieldValues();
  initEvents();
  renderPreview();
  renderStatus();
  api.onStatus((status) => { rpcStatus = status; renderStatus(); });
  setInterval(renderPreview, 1000);
}
init().catch((error) => notify("Erro ao iniciar: " + error.message));
