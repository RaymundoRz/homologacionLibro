import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllData, clearData, addData } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Deshabilitar la aceleración por hardware
app.disableHardwareAcceleration();
// Añadir switches adicionales
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// Detectar si estamos en modo desarrollo
const isDev = process.env.NODE_ENV === 'development' ||
              process.env.ELECTRON_START_URL !== undefined;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  if (isDev) {
    // Carga la URL del dev server de Vite
    // Asegúrate de que coincida con el puerto que Vite está usando
    win.loadURL('http://localhost:5175');
  } else {
    // Carga el archivo HTML compilado (build de producción)
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

}

app.whenReady().then(() => {
  createWindow();

  if (!ipcMain.listenerCount('clear-data')) {
    ipcMain.handle('clear-data', async (event, table) => {
      clearData(table);
      return true;
    });
  }
  if (!ipcMain.listenerCount('add-data')) {
    ipcMain.handle('add-data', async (event, table, data) => {
      return addData(table, data);
    });
  }
  if (!ipcMain.listenerCount('get-all-data')) {
    ipcMain.handle('get-all-data', async (event, table) => {
      return getAllData(table);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
