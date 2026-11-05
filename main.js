const { app, BrowserWindow } = require('electron');
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
let py = null;

// Optional high-fidelity engine (PyMuPDF + LibreOffice). The app works without it.
function startEngine() {
  const dir = app.isPackaged ? path.join(process.resourcesPath, 'backend') : path.join(__dirname, 'backend');
  if (!fs.existsSync(path.join(dir, 'server.py'))) return;
  const cmd = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  py = spawn(cmd, ['-m', 'uvicorn', 'server:app', '--host', '127.0.0.1', '--port', '8765'], { cwd: dir, stdio: 'ignore' });
  py.on('error', () => { py = null; });
}
function createWindow() {
  const w = new BrowserWindow({ width: 1280, height: 860, icon: path.join(__dirname, 'build', 'icon.png'), webPreferences: { contextIsolation: true, sandbox: true } });
  w.setMenuBarVisibility(false);
  w.loadFile(path.join(__dirname, 'www', 'index.html'));
}
app.whenReady().then(() => { startEngine(); createWindow(); });
app.on('window-all-closed', () => { if (py) py.kill(); app.quit(); });
