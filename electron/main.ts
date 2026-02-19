import { app, BrowserWindow, ipcMain, protocol, shell, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import { existsSync, createReadStream } from 'fs'
import electronUpdater from 'electron-updater'
const { autoUpdater } = electronUpdater
import { PythonRunner } from './python-runner'
import { ProjectManager } from './project-manager'
import { authService } from './auth-service'

// Must be called BEFORE app.whenReady - enables video streaming for custom protocol
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      bypassCSP: true,
    },
  },
])

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Force consistent app name in both dev and production so app.getPath('userData')
// always resolves to ~/Library/Application Support/CutServe (not 'cut-serve' or 'Electron')
app.setName('CutServe')

// The built directory structure
//
// ├─┬ dist-electron/
// │ ├── main.js        > Electron main process
// │ └── preload.js     > Preload script
// ├─┬ dist/
// │ └── index.html     > Electron renderer (React app)

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let mainWindow: BrowserWindow | null = null
const pythonRunner = new PythonRunner()
const projectManager = new ProjectManager()

// Dev server URL from Vite, or file path for production
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js')
  console.log('Creating window with preload:', preloadPath)
  console.log('Preload exists:', existsSync(preloadPath))
  console.log('__dirname:', __dirname)
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'CutServe',
    backgroundColor: '#020617',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Load the React app
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ─── IPC Handlers (React ↔ Electron ↔ Python) ──────────────────────────

// Start processing a video through the Python engine
ipcMain.handle('python:start-processing', async (_event, args: {
  videoPath: string
  zonesFile: string
  outputJson: string
  options?: Record<string, unknown>
}) => {
  return pythonRunner.startProcessing(args)
})

// Stop a running Python process
ipcMain.handle('python:stop-processing', async () => {
  return pythonRunner.stopProcessing()
})

// Get processing status
ipcMain.handle('python:get-status', async () => {
  return pythonRunner.getStatus()
})

// Open a file dialog (MP4 only for best export sync and quality)
ipcMain.handle('dialog:open-video', async () => {
  const { dialog } = await import('electron')
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'MP4 Video', extensions: ['mp4'] },
    ],
  })
  return result.canceled ? null : result.filePaths[0]
})

// Save-as dialog for export (default path e.g. projectName_condensed.mp4)
ipcMain.handle('dialog:save-highlights', async (_event, defaultPath: string) => {
  const { dialog } = await import('electron')
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath,
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mov'] },
    ],
  })
  return result.canceled ? null : result.filePath ?? null
})

// ─── Project Management ─────────────────────────────────────────────────

ipcMain.handle('project:list', async () => {
  return projectManager.listProjects()
})

ipcMain.handle('project:create', async (_event, videoPath: string, name?: string) => {
  return projectManager.createProject(videoPath, name)
})

ipcMain.handle('project:update', async (_event, id: string, updates: any) => {
  return projectManager.updateProject(id, updates)
})

ipcMain.handle('project:delete', async (_event, id: string) => {
  return projectManager.deleteProject(id)
})

ipcMain.handle('project:get-dir', async (_event, id: string) => {
  return projectManager.getProjectDir(id)
})

// Resolve video path from project: prefer clips.json video_path (canonical from Python), else project.videoPath
async function getVideoPathForProject(projectId: string): Promise<string | null> {
  const projects = await projectManager.listProjects()
  const project = projects.find((p) => p.id === projectId)
  if (!project?.videoPath) return null
  try {
    const clipsPath = projectManager.getClipsPath(projectId)
    const data = await fs.readFile(clipsPath, 'utf-8')
    const parsed = JSON.parse(data)
    if (parsed.video_path && typeof parsed.video_path === 'string') {
      return parsed.video_path
    }
  } catch {
    // No clips.json or parse failed, use project path
  }
  return project.videoPath
}

// Return a properly formatted local-file URL for video playback
ipcMain.handle('video:get-url', async (_event, projectId: string) => {
  const videoPath = await getVideoPathForProject(projectId)
  if (!videoPath) return null
  // Paths stored without leading slash (e.g. "users/hunterkoth/Downloads/x.mp4") must be treated as absolute
  const resolved = path.isAbsolute(videoPath) ? path.resolve(videoPath) : path.resolve('/', videoPath)
  if (!existsSync(resolved)) {
    console.error('[Video] File not found:', resolved)
    return null
  }
  const pathForUrl = process.platform === 'win32' ? '/' + resolved.replace(/\\/g, '/') : resolved
  const pathWithSlash = pathForUrl.startsWith('/') ? pathForUrl : '/' + pathForUrl
  const url = `local-file://${encodeURI(pathWithSlash)}`
  console.log('[Video] Serving:', pathWithSlash)
  return url
})

// ─── File Operations ────────────────────────────────────────────────────

ipcMain.handle('file:write-zones', async (_event, projectId: string, zones: any[]) => {
  const zonesPath = projectManager.getZonesPath(projectId)
  // Python expects just an array of zones, not an object with a "zones" property
  // Convert from [{points: [{x, y}, ...]}, ...] to [[[x, y], ...], ...]
  const zonesForPython = zones.map(zone => 
    zone.points.map((p: any) => [p.x, p.y])
  )
  await fs.writeFile(zonesPath, JSON.stringify(zonesForPython, null, 2))
  console.log('[Main] Saved zones to:', zonesPath)
  console.log('[Main] Zones data:', JSON.stringify(zonesForPython, null, 2))
  
  await projectManager.updateProject(projectId, { 
    zonesFile: zonesPath,
    status: 'zones-set'
  })
  return zonesPath
})

ipcMain.handle('file:read-clips', async (_event, projectId: string) => {
  try {
    const clipsPath = projectManager.getClipsPath(projectId)
    const data = await fs.readFile(clipsPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
})

ipcMain.handle('file:save-edited-clips', async (_event, projectId: string, clipsData: any) => {
  const clipsPath = projectManager.getClipsPath(projectId)
  // Back up existing clips before overwriting
  if (existsSync(clipsPath)) {
    await fs.copyFile(clipsPath, clipsPath + '.bak')
  }
  await fs.writeFile(clipsPath, JSON.stringify(clipsData, null, 2))
  await projectManager.updateProject(projectId, { status: 'edited' })
  return clipsPath
})

ipcMain.handle('file:read-match-setup', async (_event, projectId: string) => {
  const setupPath = projectManager.getMatchSetupPath(projectId)
  try {
    const data = await fs.readFile(setupPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
})

ipcMain.handle('file:write-match-setup', async (_event, projectId: string, setup: any) => {
  const setupPath = projectManager.getMatchSetupPath(projectId)
  await fs.writeFile(setupPath, JSON.stringify(setup, null, 2))
  return setupPath
})

// ─── Export / Rendering ─────────────────────────────────────────────────

ipcMain.handle('export:render', async (_event, args: {
  projectId: string
  videoPath: string
  clipsPath: string
  outputPath: string
  config?: Record<string, unknown>
}) => {
  return pythonRunner.runRenderer({
    videoPath: args.videoPath,
    clipsPath: args.clipsPath,
    outputPath: args.outputPath,
    config: args.config
  })
})

// Save base64 image to project dir (for stat screen or custom overlay)
ipcMain.handle('export:save-image', async (_event, projectId: string, filename: string, base64Data: string) => {
  const projectDir = projectManager.getProjectDir(projectId)
  const filePath = path.join(projectDir, filename)
  const buffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  await fs.writeFile(filePath, buffer)
  return filePath
})

// Resolve preset overlay path (public/overlays/ in dev, resources/overlays/ in production)
ipcMain.handle('export:get-overlay-path', async (_event, variant: string) => {
  const base = process.env.VITE_PUBLIC || path.join(__dirname, '..', 'public')
  const overlayPath = path.join(base, 'overlays', `${variant}.png`)
  if (existsSync(overlayPath)) return path.resolve(overlayPath)
  // Fallback: bundled resources (production)
  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, 'overlays', `${variant}.png`)
    if (existsSync(bundled)) return path.resolve(bundled)
  }
  return null
})

// Resolve bundled font path (public/fonts/ in dev, resources/fonts/ in production)
ipcMain.handle('export:get-font-path', async (_event, filename: string) => {
  const base = process.env.VITE_PUBLIC || path.join(__dirname, '..', 'public')
  const fontPath = path.join(base, 'fonts', filename)
  if (existsSync(fontPath)) return path.resolve(fontPath)
  // Fallback: bundled resources (production)
  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, 'fonts', filename)
    if (existsSync(bundled)) return path.resolve(bundled)
  }
  return null
})

// ─── Auth ────────────────────────────────────────────────────────────────

ipcMain.handle('auth:restore', async () => {
  return authService.restoreSession()
})

ipcMain.handle('auth:register', async (_event, email: string, password: string) => {
  return authService.register(email, password)
})

ipcMain.handle('auth:login', async (_event, email: string, password: string) => {
  return authService.login(email, password)
})

ipcMain.handle('auth:logout', async () => {
  return authService.logout()
})

ipcMain.handle('auth:get-profile', async () => {
  return authService.getProfile()
})

ipcMain.handle('auth:can-export', async () => {
  return authService.canExport()
})

ipcMain.handle('auth:record-export', async () => {
  return authService.recordExport()
})

// ─── Shell ───────────────────────────────────────────────────────────────

ipcMain.handle('shell:open-external', async (_event, url: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
      console.warn('[Shell] Blocked open-external with disallowed scheme:', parsed.protocol)
      return
    }
    await shell.openExternal(url)
  } catch {
    console.warn('[Shell] Blocked open-external with invalid URL:', url)
  }
})

// ─── App Lifecycle ──────────────────────────────────────────────────────

app.on('window-all-closed', () => {
  pythonRunner.stopProcessing()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  // Register custom protocol to serve local files (requires registerSchemesAsPrivileged above for video streaming)
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const raw = decodeURIComponent(request.url.replace(/^local-file:\/\//, ''))
    const pathPart = raw.startsWith('//') ? raw.slice(1) : raw
    // Paths without leading slash (e.g. "users/foo/file.mp4") must be treated as absolute
    const filePath = path.isAbsolute(pathPart) ? path.resolve(pathPart) : path.resolve('/', pathPart)
    console.log('[Protocol] Serving file:', filePath)
    callback({ path: filePath })
  })

  await projectManager.init()
  await authService.restoreSession()
  createWindow()

  // ── Auto-update (production only) ────────────────────────────────
  // Without code signing, quitAndInstall fails on macOS (Gatekeeper blocks
  // the replacement app). Instead, notify the user and link to the download.
  if (app.isPackaged) {
    autoUpdater.logger = console
    autoUpdater.autoDownload = false

    autoUpdater.on('update-available', (info) => {
      if (!mainWindow) return
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `CutServe v${info.version} is available.`,
        detail: 'Would you like to open the download page? You\'ll need to install the new version manually.',
        buttons: ['Open Download Page', 'Later'],
      }).then(({ response }) => {
        if (response === 0) {
          shell.openExternal('https://github.com/kothhunter/cutserve/releases/latest')
        }
      })
    })

    autoUpdater.checkForUpdates().catch((err) => {
      console.log('[AutoUpdate] Check failed (expected if no releases yet):', err.message)
    })
  }
})
