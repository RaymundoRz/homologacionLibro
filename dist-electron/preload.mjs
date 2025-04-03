"use strict";
const require$$0 = require("electron");
const { contextBridge, ipcRenderer } = require$$0;
contextBridge.exposeInMainWorld("api", {
  getAllData: (table) => ipcRenderer.invoke("get-all-data", table),
  clearData: (table) => ipcRenderer.invoke("clear-data", table),
  addData: (table, data) => ipcRenderer.invoke("add-data", table, data)
});
