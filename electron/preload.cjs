// electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAllData: (table) => ipcRenderer.invoke('get-all-data', table),
  clearData: (table) => ipcRenderer.invoke('clear-data', table),
  addData: (table, data) => ipcRenderer.invoke('add-data', table, data),
});
