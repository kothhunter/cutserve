// Quick diagnostic to see if Electron is loading properly
const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });
  
  win.loadURL('http://localhost:5173');
  win.webContents.openDevTools();
  
  win.webContents.on('console-message', (event, level, message) => {
    console.log('Browser console:', message);
  });
});
