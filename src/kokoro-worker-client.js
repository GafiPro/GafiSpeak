import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(sourceDirectory, "..");
const workerScript = path.join(sourceDirectory, "kokoro_worker.py");
const localPython = path.join(projectRoot, ".venv", "Scripts", "python.exe");

let workerState = null;
let requestCounter = 0;

function getPythonExecutable() {
  const configured = process.env.GAFISPEAK_PYTHON?.trim();
  if (configured) return configured;
  if (existsSync(localPython)) return localPython;
  return process.platform === "win32" ? "python" : "python3";
}

function failWorker(state, error) {
  if (state.failed) return;
  state.failed = true;

  const message = error instanceof Error ? error : new Error(String(error));
  if (!state.ready) state.rejectReady(message);

  for (const [id, pending] of state.pending) {
    pending.reject(new Error("Kokoro worker stopped while processing request " + id + ": " + message.message));
  }
  state.pending.clear();

  if (workerState === state) workerState = null;
}

function handleWorkerLine(state, line) {
  const trimmed = line.trim();
  if (!trimmed) return;

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    console.warn("[GafiSpeak] Ignoring unexpected Kokoro worker output: " + trimmed.slice(0, 300));
    return;
  }

  if (message.type === "ready") {
    if (state.ready || state.failed) return;
    state.ready = true;
    state.resolveReady(message);
    console.log(
      "[GafiSpeak] Kokoro ready on " + message.device +
      (message.cuda ? " (CUDA " + message.cuda + ")." : ".")
    );
    return;
  }

  if (message.type === "fatal") {
    failWorker(state, new Error(message.error || "Kokoro worker failed during startup."));
    return;
  }

  const pending = state.pending.get(message.id);
  if (!pending) return;

  state.pending.delete(message.id);

  if (message.type === "done") {
    pending.resolve(message);
  } else if (message.type === "error") {
    pending.reject(new Error(message.error || "Kokoro could not generate speech."));
  }
}

function startWorker() {
  const python = getPythonExecutable();
  console.log("[GafiSpeak] Starting the local Kokoro CUDA worker.");

  const child = spawn(python, ["-u", workerScript], {
    cwd: projectRoot,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"]
  });

  let resolveReady;
  let rejectReady;
  const readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const state = {
    child,
    readyPromise,
    resolveReady,
    rejectReady,
    ready: false,
    failed: false,
    shuttingDown: false,
    pending: new Map()
  };

  // A spawn error can occur before the caller starts awaiting readyPromise.
  readyPromise.catch(() => {});
  workerState = state;

  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => handleWorkerLine(state, line));

  child.stderr.on("data", (chunk) => {
    const output = chunk.toString().trimEnd();
    if (output) {
      for (const line of output.split(/\r?\n/)) {
        console.error("[Kokoro] " + line);
      }
    }
  });

  child.once("error", (error) => {
    failWorker(
      state,
      new Error(
        "Could not start Python (" + python + "). Check that the .venv is installed " +
        "and run the Python setup commands from the GafiSpeak README. " + error.message
      )
    );
  });

  child.once("exit", (code, signal) => {
    if (!state.shuttingDown) {
      failWorker(
        state,
        new Error("Kokoro worker exited unexpectedly (code " + code + ", signal " + signal + ").")
      );
    }
    lines.close();
  });

  return state;
}

async function getWorker() {
  if (!workerState || workerState.failed || workerState.child.exitCode !== null) {
    startWorker();
  }

  const state = workerState;
  await state.readyPromise;
  return state;
}

export async function generateSpeech(text, outputPath, isCurrent = () => true) {
  const state = await getWorker();
  if (!isCurrent()) return false;

  const id = ++requestCounter;
  const response = new Promise((resolve, reject) => {
    state.pending.set(id, { resolve, reject });
  });

  const payload = JSON.stringify({
    id,
    text,
    output_path: outputPath
  });

  state.child.stdin.write(payload + "\n", (error) => {
    if (!error) return;
    const pending = state.pending.get(id);
    if (pending) {
      state.pending.delete(id);
      pending.reject(error);
    }
  });

  const result = await response;
  if (!isCurrent()) return false;

  console.log("[GafiSpeak] Kokoro generated audio in " + Number(result.seconds).toFixed(2) + "s.");
  return true;
}

export function shutdownKokoroWorker() {
  const state = workerState;
  if (!state) return;

  state.shuttingDown = true;
  workerState = null;
  state.child.stdin.end();
  state.child.kill();
}
