// Safely exposes a tiny API to the page (context-isolated).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("squish", {
  isElectron: true,
  setAlwaysOnTop: (value) => ipcRenderer.invoke("set-always-on-top", value),
  setIgnore: (ignore) => ipcRenderer.send("set-ignore", ignore),
  onCommand: (cb) => ipcRenderer.on("command", (_e, name) => cb(name)),
});
