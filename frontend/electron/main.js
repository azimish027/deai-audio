/**
 * Electron 主进程：启动 FastAPI 后端子进程 + 创建 BrowserWindow。
 *
 * 开发环境：加载 Vite dev server（默认 http://localhost:5173）。
 * 生产环境：加载 Vite 构建产物（dist/index.html）。
 *
 * 跨平台关键点（main.js 里最容易翻车的地方）：
 *   - venv Python 路径：win32 → .venv/Scripts/python.exe；darwin/linux → .venv/bin/python
 *   - 系统 fallback：win32 → "python"；其它 → "python3"
 *   - Windows spawn PATH 查找不稳时，加 shell: true
 *   - 后端起得比前端慢：createWindow 前先等 /health ready（最多 30s）
 */
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;
const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";

// 可被环境变量覆盖（方便调端口/host）
const BACKEND_HOST = process.env.DEAI_BACKEND_HOST || "127.0.0.1";
const BACKEND_PORT = parseInt(process.env.DEAI_BACKEND_PORT || "8765", 10);

let mainWindow = null;
let backendProcess = null;

// ---------------------------------------------------------------------------
// 1. 按平台定位 Python 解释器
// ---------------------------------------------------------------------------
function resolvePython(backendDir) {
  // venv 里的 Python —— 按平台分流
  const venvBin = isWin
    ? path.join(backendDir, ".venv", "Scripts")
    : path.join(backendDir, ".venv", "bin");

  const venvPy = isWin
    ? path.join(venvBin, "python.exe")
    : path.join(venvBin, "python");

  if (fs.existsSync(venvPy)) {
    console.log("[electron] using venv python:", venvPy);
    return { cmd: venvPy, args: [], isVenv: true };
  }

  // fallback：系统 Python
  const sysPy = isWin ? "python" : "python3";
  console.log("[electron] venv not found, falling back to:", sysPy);
  return { cmd: sysPy, args: [], isVenv: false };
}

// ---------------------------------------------------------------------------
// 2. spawn FastAPI 后端
// ---------------------------------------------------------------------------
function startBackend() {
  const backendDir = isDev
    ? path.join(__dirname, "..", "..", "backend")
    : path.join(process.resourcesPath, "backend");

  if (!fs.existsSync(backendDir)) {
    console.error("[electron] backend dir not found:", backendDir);
    return;
  }

  const { cmd } = resolvePython(backendDir);

  // 显式传 host/port —— 不依赖 run_server.py 的默认值
  const args = [
    "-m", "uvicorn", "engine.api.server:app",
    "--host", BACKEND_HOST,
    "--port", String(BACKEND_PORT),
  ];

  const spawnOpts = {
    cwd: backendDir,
    stdio: "pipe",
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
    windowsHide: true,
  };
  // Windows 上 PATH 查找 python 有时不稳，加 shell: true 更可靠
  if (isWin) spawnOpts.shell = true;

  console.log("[electron] spawning backend:", cmd, args.join(" "));
  backendProcess = spawn(cmd, args, spawnOpts);

  backendProcess.stdout.on("data", (d) => {
    console.log("[backend]", d.toString().trim());
  });
  backendProcess.stderr.on("data", (d) => {
    console.error("[backend]", d.toString().trim());
  });
  backendProcess.on("exit", (code, signal) => {
    console.log(`[backend] exited code=${code} signal=${signal}`);
    backendProcess = null;
  });
  backendProcess.on("error", (err) => {
    console.error("[backend] spawn error:", err.message);
    backendProcess = null;
  });
}

// ---------------------------------------------------------------------------
// 3. 轮询 /health 直到 ready（最多 30s）
// ---------------------------------------------------------------------------
function waitForBackend(timeoutMs = 30000, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const probe = () => {
      const req = http.get(
        `http://${BACKEND_HOST}:${BACKEND_PORT}/health`,
        (res) => {
          if (res.statusCode === 200) {
            res.resume();
            resolve(true);
          } else {
            retry();
          }
        },
      );
      req.on("error", retry);
      req.setTimeout(2000, () => { req.destroy(); retry(); });
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`backend health check timeout after ${timeoutMs}ms`));
      } else {
        setTimeout(probe, intervalMs);
      }
    };

    probe();
  });
}

// ---------------------------------------------------------------------------
// 4. BrowserWindow
// ---------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: "DeAI Audio — 去 AI 化音频处理",
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("closed", () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ---------------------------------------------------------------------------
// 5. 生命周期
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  startBackend();

  try {
    await waitForBackend();
    console.log("[electron] backend ready on", BACKEND_HOST + ":" + BACKEND_PORT);
  } catch (e) {
    console.error("[electron] backend failed to start:", e.message);
    // 就算后端没起来，也先开窗口让用户看到报错 UI
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill("SIGTERM");
  if (!isMac) app.quit();
});

app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill("SIGTERM");
});

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle("app:get-version", () => app.getVersion());
ipcMain.handle("app:get-backend-status", () => !!backendProcess);
ipcMain.handle("app:get-platform", () => ({
  platform: process.platform,
  arch: process.arch,
  backendHost: BACKEND_HOST,
  backendPort: BACKEND_PORT,
}));
