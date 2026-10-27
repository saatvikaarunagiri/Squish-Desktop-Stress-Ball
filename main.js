// Squish — Electron main process.
// Runs the ball as a transparent, frameless, always-on-top overlay that
// floats over the whole desktop. The window ignores mouse clicks everywhere
// except over the ball itself (the renderer toggles this as you hover), so
// your desktop stays fully usable. A tray/menu-bar icon lets you quit.

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen } = require("electron");
const path = require("path");

let win, tray;

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const wa = display.workArea; // excludes the menu bar and the Dock

  win = new BrowserWindow({
    x: wa.x,
    y: wa.y,
    width: wa.width,
    height: wa.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    hasShadow: false,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    fullscreenable: false,
    title: "Squish",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, "floating");
  try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (e) {}
  // Start click-through; the renderer turns this off while the pointer is on the ball.
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function send(cmd) { if (win && !win.isDestroyed()) win.webContents.send("command", cmd); }

function createTray() {
  let img = nativeImage.createFromPath(path.join(__dirname, "build", "icon.png"));
  if (!img.isEmpty()) img = img.resize({ width: 18, height: 18 });
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip("Squish");
  const menu = Menu.buildFromTemplate([
    { label: "Settings…",         click: () => send("settings") },
    { type: "separator" },
    { label: "Wake it up",        click: () => send("wake") },
    { label: "Rest now",          click: () => send("rest") },
    { label: "Reset to centre",   click: () => send("reset") },
    { type: "separator" },
    { label: "Quit Squish",       click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => send("wake"));
}

// Renderer asks to pass clicks through (true) or capture them (false, over the ball).
ipcMain.on("set-ignore", (_e, ignore) => {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!!ignore, { forward: true });
});

// Legacy toggle kept so the Settings switch still works.
ipcMain.handle("set-always-on-top", (_e, value) => {
  if (win) win.setAlwaysOnTop(!!value, "floating");
  return !!value;
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// With no visible window to close, keep running until quit from the tray/Dock.
app.on("window-all-closed", () => {});
