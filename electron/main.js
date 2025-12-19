import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0d1117', // Matches tailwind gray-950
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Simplifying for V0; enables simpler local dev
      webSecurity: false // Allows loading local resources (file://) if needed later
    },
    autoHideMenuBar: true
  });

  // In development, load the local Vite server
  win.loadURL('http://localhost:5173');
  
  // Open DevTools optionally
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});