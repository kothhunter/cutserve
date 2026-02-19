# Roundnet Condenser - Codebase Guide

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Electron Process Files](#electron-process-files)
3. [React Frontend Files](#react-frontend-files)
4. [Python Backend Files](#python-backend-files)
5. [Configuration Files](#configuration-files)
6. [Assets & Static Files](#assets--static-files)
7. [Development Dependencies](#development-dependencies)
8. [File Dependency Graph](#file-dependency-graph)

---

## Directory Structure

```
roundnet-desktop/
├── electron/                    # Electron main process (Node.js)
├── src/                        # React frontend (renderer process)
├── python/                     # Python backend (video processing)
├── public/                     # Static assets
├── dist/                       # Vite build output (React app)
├── dist-electron/              # Electron process builds
├── node_modules/               # NPM dependencies
├── yolov8n-pose.pt            # YOLOv8 pose detection model
└── [config files]              # Build/development configuration
```

---

## Electron Process Files

All files in the `electron/` directory run in the **Main Process** (Node.js context) with full system access.

### electron/main.ts

**Purpose:** Electron application entry point, window management, and protocol registration

**Key Responsibilities:**
- Create and configure `BrowserWindow`
- Register custom `local-file://` protocol for video streaming
- Load app UI (dev server in development, `dist/index.html` in production)
- Handle app lifecycle events (`ready`, `window-all-closed`, `activate`)
- Set up application menu (macOS)

**Important Functions:**

```typescript
function createWindow() {
  // Creates main application window
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      contextIsolation: true,      // Security: separate JS contexts
      nodeIntegration: false,       // Security: no Node.js in renderer
      preload: preloadPath          // Inject secure API
    },
    titleBarStyle: 'hiddenInset',   // Custom title bar styling
    trafficLightPosition: { x: 15, y: 15 }
  })

  // Load app UI
  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function registerLocalFileProtocol() {
  // Custom protocol for video streaming with seek support
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const url = request.url.replace('local-file://', '')
    callback({ path: url })
  })
}
```

**Imports:**
```typescript
import { app, BrowserWindow, protocol } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import './project-manager.js'  // Registers IPC handlers
import './python-runner.js'    // Registers Python IPC handlers
```

**Lines of Code:** ~150 lines

---

### electron/preload.ts

**Purpose:** Secure bridge between renderer and main process using `contextBridge`

**Key Responsibilities:**
- Expose type-safe IPC API to renderer via `window.api`
- Validate and sanitize IPC calls
- Prevent direct access to Electron/Node.js APIs

**Exposed API Structure:**

```typescript
contextBridge.exposeInMainWorld('api', {
  // Project management
  project: {
    list: () => ipcRenderer.invoke('project:list'),
    create: (videoPath, name) => ipcRenderer.invoke('project:create', videoPath, name),
    update: (id, updates) => ipcRenderer.invoke('project:update', id, updates),
    delete: (id) => ipcRenderer.invoke('project:delete', id),
    getDir: (id) => ipcRenderer.invoke('project:get-dir', id)
  },

  // File operations
  file: {
    writeZones: (projectId, zones) => ipcRenderer.invoke('file:write-zones', projectId, zones),
    readClips: (projectId) => ipcRenderer.invoke('file:read-clips', projectId),
    saveEditedClips: (projectId, clipsData) => ipcRenderer.invoke('file:save-edited-clips', projectId, clipsData),
    readMatchSetup: (projectId) => ipcRenderer.invoke('file:read-match-setup', projectId),
    writeMatchSetup: (projectId, setup) => ipcRenderer.invoke('file:write-match-setup', projectId, setup)
  },

  // Video operations
  video: {
    getUrl: (projectId) => ipcRenderer.invoke('video:get-url', projectId)
  },

  // Python processing
  python: {
    startProcessing: (args) => ipcRenderer.invoke('python:start-processing', args),
    stopProcessing: () => ipcRenderer.invoke('python:stop-processing'),
    getStatus: () => ipcRenderer.invoke('python:get-status')
  },

  // Export operations
  export: {
    render: (args) => ipcRenderer.invoke('export:render', args),
    saveImage: (projectId, filename, base64) => ipcRenderer.invoke('export:save-image', projectId, filename, base64),
    getOverlayPath: (variant) => ipcRenderer.invoke('export:get-overlay-path', variant)
  },

  // File dialogs
  dialog: {
    openVideo: () => ipcRenderer.invoke('dialog:open-video'),
    saveHighlights: (defaultPath) => ipcRenderer.invoke('dialog:save-highlights', defaultPath)
  },

  // Event listeners
  onPythonProgress: (callback) => {
    ipcRenderer.on('python:progress', (_, data) => callback(data))
  },
  onPythonComplete: (callback) => {
    ipcRenderer.on('python:complete', (_, data) => callback(data))
  },
  onPythonError: (callback) => {
    ipcRenderer.on('python:error', (_, data) => callback(data))
  },
  onRenderComplete: (callback) => {
    ipcRenderer.on('render:complete', (_, data) => callback(data))
  },
  onRenderError: (callback) => {
    ipcRenderer.on('render:error', (_, data) => callback(data))
  },
  removeListener: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  }
})
```

**Security Features:**
- Only specific channels exposed (no raw `ipcRenderer` access)
- No direct file system access
- No ability to execute arbitrary code

**Build:** Compiled separately with ESBuild to CommonJS format

**Lines of Code:** ~120 lines

---

### electron/project-manager.ts

**Purpose:** Project CRUD operations and file system management

**Key Responsibilities:**
- Load/save projects index (`projects.json`)
- Create project directories
- Read/write project files (zones, clips, match setup)
- Manage project lifecycle and metadata

**IPC Handlers Registered:**

```typescript
// Project management
ipcMain.handle('project:list', async () => {
  return await loadProjects()
})

ipcMain.handle('project:create', async (event, videoPath, name) => {
  const project = {
    id: Date.now().toString(),
    name: name || path.basename(videoPath, path.extname(videoPath)),
    videoPath,
    videoName: path.basename(videoPath),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'new',
    processingProgress: 0
  }

  // Create project directory
  const projectDir = path.join(getProjectsDir(), project.id)
  await fs.mkdir(projectDir, { recursive: true })

  // Save to index
  const projects = await loadProjects()
  projects.push(project)
  await saveProjects(projects)

  return project
})

ipcMain.handle('project:update', async (event, id, updates) => {
  const projects = await loadProjects()
  const index = projects.findIndex(p => p.id === id)

  if (index === -1) {
    throw new Error('Project not found')
  }

  projects[index] = {
    ...projects[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  await saveProjects(projects)
  return projects[index]
})

ipcMain.handle('project:delete', async (event, id) => {
  const projects = await loadProjects()
  const index = projects.findIndex(p => p.id === id)

  if (index === -1) {
    throw new Error('Project not found')
  }

  // Delete project directory
  const projectDir = path.join(getProjectsDir(), id)
  await fs.rm(projectDir, { recursive: true, force: true })

  // Remove from index
  projects.splice(index, 1)
  await saveProjects(projects)
})

// File operations
ipcMain.handle('file:write-zones', async (event, projectId, zones) => {
  const projectDir = path.join(getProjectsDir(), projectId)
  const zonesPath = path.join(projectDir, 'court_zones.json')

  await fs.writeFile(zonesPath, JSON.stringify(zones, null, 2))

  // Update project metadata
  await updateProject(projectId, {
    zonesFile: zonesPath,
    status: 'zones-set'
  })

  return zonesPath
})

ipcMain.handle('file:read-clips', async (event, projectId) => {
  const projectDir = path.join(getProjectsDir(), projectId)
  const clipsPath = path.join(projectDir, 'clips.json')

  const data = await fs.readFile(clipsPath, 'utf8')
  return JSON.parse(data)
})

// More handlers for match setup, export config, etc.
```

**Helper Functions:**

```typescript
function getProjectsDir(): string {
  // ~/Documents/Roundnet Projects/
  return path.join(app.getPath('documents'), 'Roundnet Projects')
}

function getAppDataPath(): string {
  // ~/Library/Application Support/roundnet-condenser/
  return path.join(app.getPath('appData'), 'roundnet-condenser')
}

async function loadProjects(): Promise<Project[]> {
  const projectsPath = path.join(getAppDataPath(), 'projects.json')

  try {
    const data = await fs.readFile(projectsPath, 'utf8')
    return JSON.parse(data)
  } catch {
    return []  // File doesn't exist yet
  }
}

async function saveProjects(projects: Project[]): Promise<void> {
  const projectsPath = path.join(getAppDataPath(), 'projects.json')

  // Ensure directory exists
  await fs.mkdir(path.dirname(projectsPath), { recursive: true })

  await fs.writeFile(projectsPath, JSON.stringify(projects, null, 2))
}
```

**Lines of Code:** ~300 lines

---

### electron/python-runner.ts

**Purpose:** Spawn and manage Python child processes for video processing

**Key Responsibilities:**
- Spawn Python subprocess with arguments
- Parse stdout for progress updates
- Emit IPC events to renderer (progress, complete, error)
- Handle process cleanup

**IPC Handlers Registered:**

```typescript
let pythonProcess: ChildProcess | null = null
let processingStatus = {
  running: false,
  progress: 0,
  currentFrame: 0,
  totalFrames: 0
}

ipcMain.handle('python:start-processing', async (event, args: PythonArgs) => {
  if (pythonProcess) {
    return { success: false, message: 'Processing already running' }
  }

  const { videoPath, projectDir, zonesPath } = args

  // Build command
  const pythonPath = 'python3'  // TODO: Bundle Python in production
  const scriptPath = path.join(__dirname, '../../python/main.py')

  const cmd = [
    scriptPath,
    '--video', videoPath,
    '--zones', zonesPath,
    '--output', path.join(projectDir, 'clips.json')
  ]

  // Spawn process
  pythonProcess = spawn(pythonPath, cmd)

  processingStatus.running = true

  // Parse stdout for progress
  pythonProcess.stdout?.on('data', (data) => {
    const output = data.toString()

    // Match: "Progress: 45% (1350/3000)"
    const progressMatch = output.match(/Progress: (\d+)% \((\d+)\/(\d+)\)/)
    if (progressMatch) {
      processingStatus.progress = parseInt(progressMatch[1])
      processingStatus.currentFrame = parseInt(progressMatch[2])
      processingStatus.totalFrames = parseInt(progressMatch[3])

      // Emit to renderer
      BrowserWindow.getAllWindows()[0]?.webContents.send('python:progress', processingStatus)
    }
  })

  // Handle completion
  pythonProcess.on('close', (code) => {
    processingStatus.running = false

    if (code === 0) {
      BrowserWindow.getAllWindows()[0]?.webContents.send('python:complete', {
        clipsPath: path.join(projectDir, 'clips.json')
      })
    } else {
      BrowserWindow.getAllWindows()[0]?.webContents.send('python:error', {
        error: 'Processing failed with exit code ' + code
      })
    }

    pythonProcess = null
  })

  // Handle errors
  pythonProcess.on('error', (error) => {
    processingStatus.running = false
    BrowserWindow.getAllWindows()[0]?.webContents.send('python:error', {
      error: error.message
    })
    pythonProcess = null
  })

  return { success: true, message: 'Processing started' }
})

ipcMain.handle('python:stop-processing', async () => {
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM')
    pythonProcess = null
    processingStatus.running = false
    return { success: true }
  }
  return { success: false }
})

ipcMain.handle('python:get-status', async () => {
  return processingStatus
})
```

**Lines of Code:** ~200 lines

---

## React Frontend Files

All files in `src/` run in the **Renderer Process** (Chromium browser context) with restricted access.

### src/main.tsx

**Purpose:** React application entry point

**Responsibilities:**
- Mount React app to DOM
- Import global styles
- Wrap app in `React.StrictMode`

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**Lines of Code:** ~10 lines

---

### src/App.tsx

**Purpose:** Root component with routing logic

**Responsibilities:**
- Manage application-level state (current view)
- Route to appropriate component based on project status
- Provide navigation functions

**Routing Logic:**

```typescript
function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'zones' | 'match-setup' | 'editor' | 'export'>('dashboard')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Determine which view to show based on project status
  useEffect(() => {
    if (!selectedProject) {
      setCurrentView('dashboard')
      return
    }

    switch (selectedProject.status) {
      case 'new':
      case 'zones-set':
        setCurrentView('zones')
        break

      case 'processing':
        // Stay on dashboard, show progress
        setCurrentView('dashboard')
        break

      case 'processed':
        // Check if match setup exists
        window.api.file.readMatchSetup(selectedProject.id).then(setup => {
          if (setup) {
            setCurrentView('editor')
          } else {
            setCurrentView('match-setup')
          }
        })
        break

      case 'edited':
      case 'exported':
        setCurrentView('editor')
        break
    }
  }, [selectedProject])

  // Render current view
  return (
    <div className="app">
      {currentView === 'dashboard' && (
        <Dashboard onSelectProject={setSelectedProject} />
      )}

      {currentView === 'zones' && selectedProject && (
        <ZoneWizard
          project={selectedProject}
          onComplete={() => {
            // Refresh project and return to dashboard
            window.api.project.list().then(projects => {
              const updated = projects.find(p => p.id === selectedProject.id)
              if (updated) setSelectedProject(updated)
            })
          }}
          onBack={() => setSelectedProject(null)}
        />
      )}

      {currentView === 'match-setup' && selectedProject && (
        <MatchSetupWizard
          project={selectedProject}
          onComplete={() => setCurrentView('editor')}
          onBack={() => setSelectedProject(null)}
        />
      )}

      {currentView === 'editor' && selectedProject && (
        <Editor
          project={selectedProject}
          onExport={() => setCurrentView('export')}
          onBack={() => setSelectedProject(null)}
        />
      )}

      {currentView === 'export' && selectedProject && (
        <Export
          project={selectedProject}
          onBack={() => setCurrentView('editor')}
        />
      )}
    </div>
  )
}
```

**Lines of Code:** ~150 lines

---

### src/components/Dashboard.tsx

**Purpose:** Project management hub (list, create, delete projects)

**Key Features:**
- Display all projects with status badges
- Create new project (file picker)
- Start processing (if zones set)
- Delete projects
- Real-time progress updates during processing

**Component Structure:**

```typescript
function Dashboard({ onSelectProject }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [processingProjectId, setProcessingProjectId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [])

  // Listen for Python progress events
  useEffect(() => {
    window.api.onPythonProgress((data) => {
      setProgress(data.progress)
    })

    window.api.onPythonComplete(() => {
      setProcessingProjectId(null)
      loadProjects()  // Refresh list
    })

    return () => {
      window.api.removeListener('python:progress')
      window.api.removeListener('python:complete')
    }
  }, [])

  async function loadProjects() {
    const allProjects = await window.api.project.list()
    setProjects(allProjects)
  }

  async function handleCreateProject() {
    const videoPath = await window.api.dialog.openVideo()
    if (!videoPath) return

    const project = await window.api.project.create(videoPath)
    await loadProjects()
    onSelectProject(project)  // Go to zone wizard
  }

  async function handleStartProcessing(project: Project) {
    if (!project.zonesFile) {
      alert('Please set zones first')
      return
    }

    setProcessingProjectId(project.id)

    const result = await window.api.python.startProcessing({
      videoPath: project.videoPath,
      projectDir: await window.api.project.getDir(project.id),
      zonesPath: project.zonesFile
    })

    if (!result.success) {
      alert(result.message)
      setProcessingProjectId(null)
    }

    // Update project status
    await window.api.project.update(project.id, { status: 'processing' })
    await loadProjects()
  }

  async function handleDeleteProject(id: string) {
    if (!confirm('Delete this project?')) return

    await window.api.project.delete(id)
    await loadProjects()
  }

  return (
    <div className="dashboard">
      <header>
        <h1>Roundnet Condenser</h1>
        <button onClick={handleCreateProject}>New Project</button>
      </header>

      <div className="project-list">
        {projects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            isProcessing={processingProjectId === project.id}
            progress={processingProjectId === project.id ? progress : undefined}
            onSelect={() => onSelectProject(project)}
            onProcess={() => handleStartProcessing(project)}
            onDelete={() => handleDeleteProject(project.id)}
          />
        ))}
      </div>
    </div>
  )
}
```

**Status Badge Logic:**

```typescript
function getStatusBadge(project: Project) {
  switch (project.status) {
    case 'new':
      return <Badge color="gray">New</Badge>

    case 'zones-set':
      return <Badge color="blue">Zones ✓</Badge>

    case 'processing':
      return <Badge color="yellow">Processing {project.processingProgress}%</Badge>

    case 'processed':
      return <Badge color="green">Clips ✓</Badge>

    case 'edited':
      return <Badge color="purple">Edited ✓</Badge>

    case 'exported':
      return <Badge color="indigo">Exported ✓</Badge>
  }
}
```

**Lines of Code:** ~400 lines

---

### src/components/ZoneWizard.tsx

**Purpose:** Interactive zone drawing tool

**Key Features:**
- Display first frame of video
- Click to place 4 corner points per zone
- Visual feedback (lines connecting points)
- Draw 4 zones in sequence
- Save zones to JSON

**Component Structure:**

```typescript
function ZoneWizard({ project, onComplete, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [zones, setZones] = useState<Point[][][]>([[], [], [], []])  // 4 zones
  const [currentZone, setCurrentZone] = useState(0)
  const [videoLoaded, setVideoLoaded] = useState(false)

  // Load video and capture first frame
  useEffect(() => {
    async function loadVideo() {
      const videoUrl = await window.api.video.getUrl(project.id)
      if (!videoUrl || !videoRef.current) return

      videoRef.current.src = videoUrl
      videoRef.current.currentTime = 0

      videoRef.current.addEventListener('loadeddata', () => {
        setVideoLoaded(true)
        drawFrame()
      })
    }

    loadVideo()
  }, [project.id])

  function drawFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame
    ctx.drawImage(video, 0, 0)

    // Draw existing zones and points
    zones.forEach((zone, index) => {
      ctx.strokeStyle = index === currentZone ? '#3b82f6' : '#10b981'
      ctx.lineWidth = 3

      if (zone.length > 0) {
        ctx.beginPath()
        ctx.moveTo(zone[0][0], zone[0][1])

        for (let i = 1; i < zone.length; i++) {
          ctx.lineTo(zone[i][0], zone[i][1])
        }

        if (zone.length === 4) {
          ctx.closePath()  // Complete polygon
        }

        ctx.stroke()

        // Draw points
        zone.forEach(point => {
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(point[0], point[1], 5, 0, 2 * Math.PI)
          ctx.fill()
        })
      }
    })
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height

    const newZones = [...zones]
    newZones[currentZone].push([x, y])

    setZones(newZones)

    // Move to next zone after 4 points
    if (newZones[currentZone].length === 4) {
      if (currentZone < 3) {
        setCurrentZone(currentZone + 1)
      }
    }

    drawFrame()
  }

  async function handleSave() {
    // Validate all zones have 4 points
    if (zones.some(zone => zone.length !== 4)) {
      alert('Please complete all 4 zones (4 points each)')
      return
    }

    // Save to backend
    const zonesPath = await window.api.file.writeZones(project.id, zones)

    // Update project
    await window.api.project.update(project.id, {
      zonesFile: zonesPath,
      status: 'zones-set'
    })

    onComplete()
  }

  return (
    <div className="zone-wizard">
      <header>
        <button onClick={onBack}>← Back</button>
        <h2>Draw Court Zones - Zone {currentZone + 1} of 4</h2>
        <button onClick={handleSave} disabled={zones[3].length !== 4}>
          Save Zones
        </button>
      </header>

      <div className="canvas-container">
        <video ref={videoRef} style={{ display: 'none' }} />
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{ maxWidth: '100%', cursor: 'crosshair' }}
        />
      </div>

      <div className="instructions">
        <p>Click 4 corners of Zone {currentZone + 1}</p>
        <p>Points placed: {zones[currentZone].length} / 4</p>
      </div>
    </div>
  )
}
```

**Lines of Code:** ~350 lines

---

### src/components/MatchSetupWizard.tsx

**Purpose:** Configure teams, players, and match rules

**Key Features:**
- Set team names and colors
- Assign player names
- Choose serving style (traditional or equal)
- Select first server and receiver
- Set target score

**Component Structure:**

```typescript
function MatchSetupWizard({ project, onComplete, onBack }: Props) {
  const [matchSetup, setMatchSetup] = useState<MatchSetup>({
    team1: {
      id: 'team1',
      name: 'Team 1',
      color: '#3b82f6',
      players: [
        { id: 'A', name: 'Player A', teamId: 'team1' },
        { id: 'B', name: 'Player B', teamId: 'team1' }
      ]
    },
    team2: {
      id: 'team2',
      name: 'Team 2',
      color: '#ef4444',
      players: [
        { id: 'C', name: 'Player C', teamId: 'team2' },
        { id: 'D', name: 'Player D', teamId: 'team2' }
      ]
    },
    servingStyle: 'traditional',
    targetScore: 21,
    firstServerId: 'A',
    firstReceiverId: 'C'
  })

  function updateTeamName(teamId: string, name: string) {
    setMatchSetup(prev => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        name
      }
    }))
  }

  function updatePlayerName(playerId: string, name: string) {
    setMatchSetup(prev => {
      const team = playerId === 'A' || playerId === 'B' ? 'team1' : 'team2'
      const players = prev[team].players.map(p =>
        p.id === playerId ? { ...p, name } : p
      )

      return {
        ...prev,
        [team]: {
          ...prev[team],
          players
        }
      }
    })
  }

  async function handleSave() {
    // Validate
    if (matchSetup.team1.name.trim() === '' || matchSetup.team2.name.trim() === '') {
      alert('Please enter team names')
      return
    }

    // Save to backend
    await window.api.file.writeMatchSetup(project.id, matchSetup)

    // Update project status
    await window.api.project.update(project.id, { status: 'edited' })

    onComplete()
  }

  return (
    <div className="match-setup-wizard">
      <header>
        <button onClick={onBack}>← Back</button>
        <h2>Match Setup</h2>
        <button onClick={handleSave}>Continue</button>
      </header>

      <div className="setup-form">
        <section>
          <h3>Team 1</h3>
          <input
            type="text"
            value={matchSetup.team1.name}
            onChange={(e) => updateTeamName('team1', e.target.value)}
            placeholder="Team name"
          />
          <input
            type="color"
            value={matchSetup.team1.color}
            onChange={(e) => setMatchSetup(prev => ({
              ...prev,
              team1: { ...prev.team1, color: e.target.value }
            }))}
          />

          <h4>Players</h4>
          {matchSetup.team1.players.map(player => (
            <input
              key={player.id}
              type="text"
              value={player.name}
              onChange={(e) => updatePlayerName(player.id, e.target.value)}
              placeholder={`Player ${player.id} name`}
            />
          ))}
        </section>

        <section>
          <h3>Team 2</h3>
          {/* Similar inputs for team 2 */}
        </section>

        <section>
          <h3>Match Rules</h3>
          <label>
            Serving Style:
            <select
              value={matchSetup.servingStyle}
              onChange={(e) => setMatchSetup(prev => ({
                ...prev,
                servingStyle: e.target.value as 'traditional' | 'equal'
              }))}
            >
              <option value="traditional">Traditional</option>
              <option value="equal">Equal Serving</option>
            </select>
          </label>

          <label>
            Target Score:
            <input
              type="number"
              value={matchSetup.targetScore}
              onChange={(e) => setMatchSetup(prev => ({
                ...prev,
                targetScore: parseInt(e.target.value)
              }))}
            />
          </label>

          <label>
            First Server:
            <select
              value={matchSetup.firstServerId}
              onChange={(e) => setMatchSetup(prev => ({
                ...prev,
                firstServerId: e.target.value
              }))}
            >
              {[...matchSetup.team1.players, ...matchSetup.team2.players].map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          <label>
            First Receiver:
            <select
              value={matchSetup.firstReceiverId}
              onChange={(e) => setMatchSetup(prev => ({
                ...prev,
                firstReceiverId: e.target.value
              }))}
            >
              {[...matchSetup.team1.players, ...matchSetup.team2.players].map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        </section>
      </div>
    </div>
  )
}
```

**Lines of Code:** ~300 lines

---

### src/components/Editor.tsx

**Purpose:** Clip editing interface with filmstrip, video playback, and statistics assignment

**Key Features:**
- Filmstrip navigation (horizontal scroll)
- Video playback with seek
- Trash/restore clips
- Nudge controls (frame-accurate boundary adjustment)
- Stat type assignment per clip
- Player tagging
- "Play All" mode (preview all kept clips)

**Component Structure:**

```typescript
function Editor({ project, onExport, onBack }: Props) {
  const [clips, setClips] = useState<Clip[]>([])
  const [selectedClipIndex, setSelectedClipIndex] = useState(0)
  const [matchSetup, setMatchSetup] = useState<MatchSetup | null>(null)
  const [matchFlow, setMatchFlow] = useState<Map<number, RoundnetState>>(new Map())
  const [playAllMode, setPlayAllMode] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Load clips and match setup
  useEffect(() => {
    async function loadData() {
      const clipsData = await window.api.file.readClips(project.id)
      setClips(clipsData.clips)

      const setup = await window.api.file.readMatchSetup(project.id)
      setMatchSetup(setup)

      if (setup) {
        // Calculate match flow from clips
        const flow = calculateMatchFlow(clipsData.clips, setup)
        setMatchFlow(flow)
      }
    }

    loadData()
  }, [project.id])

  // Load video
  useEffect(() => {
    async function loadVideo() {
      const videoUrl = await window.api.video.getUrl(project.id)
      if (videoUrl && videoRef.current) {
        videoRef.current.src = videoUrl
      }
    }

    loadVideo()
  }, [project.id])

  // Seek video when clip changes
  useEffect(() => {
    if (videoRef.current && clips[selectedClipIndex]) {
      const clip = clips[selectedClipIndex]
      videoRef.current.currentTime = clip.start
    }
  }, [selectedClipIndex, clips])

  function handleTrashClip(index: number) {
    const newClips = [...clips]
    newClips[index].status = 'trash'
    setClips(newClips)
    saveClips(newClips)
  }

  function handleRestoreClip(index: number) {
    const newClips = [...clips]
    newClips[index].status = 'pending'
    setClips(newClips)
    saveClips(newClips)
  }

  function handleNudgeStart(delta: number) {
    const newClips = [...clips]
    const clip = newClips[selectedClipIndex]

    clip.start = Math.max(0, clip.start + delta)
    clip.duration = clip.end - clip.start

    setClips(newClips)
    saveClips(newClips)

    // Update video
    if (videoRef.current) {
      videoRef.current.currentTime = clip.start
    }
  }

  function handleNudgeEnd(delta: number) {
    const newClips = [...clips]
    const clip = newClips[selectedClipIndex]

    clip.end = clip.end + delta
    clip.duration = clip.end - clip.start

    setClips(newClips)
    saveClips(newClips)
  }

  function handleAssignStat(statType: StatType, playerIds: string[]) {
    const newClips = [...clips]
    const clip = newClips[selectedClipIndex]

    clip.statType = statType
    clip.involvedPlayers = playerIds
    clip.status = 'done'

    setClips(newClips)
    saveClips(newClips)

    // Update match flow
    if (matchSetup) {
      const newFlow = updateMatchFlow(matchFlow, clip, matchSetup)
      setMatchFlow(newFlow)
    }

    // Auto-advance to next clip
    if (selectedClipIndex < clips.length - 1) {
      setSelectedClipIndex(selectedClipIndex + 1)
    }
  }

  async function saveClips(updatedClips: Clip[]) {
    await window.api.file.saveEditedClips(project.id, {
      clips: updatedClips,
      metadata: {}  // Preserve existing metadata
    })
  }

  function handlePlayAll() {
    setPlayAllMode(true)

    const keptClips = clips.filter(c => c.status !== 'trash')
    let currentIndex = 0

    function playNextClip() {
      if (currentIndex >= keptClips.length) {
        setPlayAllMode(false)
        return
      }

      const clip = keptClips[currentIndex]
      const video = videoRef.current

      if (video) {
        video.currentTime = clip.start

        // Set up listener for clip end
        const checkTime = () => {
          if (video.currentTime >= clip.end) {
            video.removeEventListener('timeupdate', checkTime)
            currentIndex++
            playNextClip()
          }
        }

        video.addEventListener('timeupdate', checkTime)
        video.play()
      }
    }

    playNextClip()
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'a':
        case 'A':
          handleNudgeStart(-0.5)  // Move start earlier
          break
        case 'd':
        case 'D':
          handleNudgeStart(0.5)   // Move start later
          break
        case 'ArrowLeft':
          handleNudgeEnd(-0.5)    // Move end earlier
          break
        case 'ArrowRight':
          handleNudgeEnd(0.5)     // Move end later
          break
        case ' ':
          e.preventDefault()
          videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause()
          break
        case 't':
        case 'T':
          handleTrashClip(selectedClipIndex)
          break
        // Numbers 1-9 for stat types
        case '1':
          handleAssignStat('ace', [])
          break
        // ... more shortcuts
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedClipIndex, clips])

  return (
    <div className="editor">
      <header>
        <button onClick={onBack}>← Back</button>
        <h2>Clip Editor - {clips.filter(c => c.status !== 'trash').length} / {clips.length} clips</h2>
        <button onClick={handlePlayAll}>Play All</button>
        <button onClick={onExport}>Broadcast Studio →</button>
      </header>

      {/* Filmstrip */}
      <div className="filmstrip">
        {clips.map((clip, index) => (
          <div
            key={clip.id}
            className={`clip-thumbnail ${clip.status === 'trash' ? 'trashed' : ''} ${index === selectedClipIndex ? 'selected' : ''}`}
            onClick={() => setSelectedClipIndex(index)}
          >
            <div className="clip-number">#{clip.id}</div>
            <div className="clip-tag" style={{ backgroundColor: getTagColor(clip.tag) }}>
              {clip.tag}
            </div>
            <div className="clip-duration">{clip.duration.toFixed(1)}s</div>
          </div>
        ))}
      </div>

      {/* Video player */}
      <div className="video-container">
        <video ref={videoRef} controls />

        {/* Current clip overlay */}
        {clips[selectedClipIndex] && (
          <StatOverlay
            state={matchFlow.get(clips[selectedClipIndex].id)}
            team1={matchSetup?.team1}
            team2={matchSetup?.team2}
          />
        )}
      </div>

      {/* Controls */}
      <NudgeControls
        clip={clips[selectedClipIndex]}
        onNudgeStart={handleNudgeStart}
        onNudgeEnd={handleNudgeEnd}
        onTrash={() => handleTrashClip(selectedClipIndex)}
        onRestore={() => handleRestoreClip(selectedClipIndex)}
      />

      {/* Stat assignment */}
      <div className="stat-assignment">
        <h3>Assign Stat Type</h3>
        <div className="stat-buttons">
          <button onClick={() => handleAssignStat('ace', [])}>Ace</button>
          <button onClick={() => handleAssignStat('double_fault', [])}>Double Fault</button>
          <button onClick={() => handleAssignStat('service_break', [])}>Service Break</button>
          <button onClick={() => handleAssignStat('side_out', [])}>Side Out</button>
          <button onClick={() => handleAssignStat('hitting_error', [])}>Hitting Error</button>
        </div>
      </div>

      {/* Statistics table */}
      {matchSetup && (
        <StatTable
          clips={clips.filter(c => c.status !== 'trash')}
          matchSetup={matchSetup}
          matchFlow={matchFlow}
        />
      )}
    </div>
  )
}

function getTagColor(tag: string) {
  switch (tag) {
    case 'Rally': return '#10b981'  // Green
    case 'Serve': return '#f59e0b'  // Yellow
    case 'Noise': return '#ef4444'  // Red
    default: return '#6b7280'       // Gray
  }
}
```

**Lines of Code:** ~600 lines

---

### src/components/NudgeControls.tsx

**Purpose:** Fine-tuning controls for clip boundaries

**Key Features:**
- Keyboard shortcuts display
- Visual buttons for nudging start/end
- Trash/restore toggle
- Duration display

```typescript
function NudgeControls({ clip, onNudgeStart, onNudgeEnd, onTrash, onRestore }: Props) {
  return (
    <div className="nudge-controls">
      <div className="control-group">
        <label>Start Time</label>
        <div className="buttons">
          <button onClick={() => onNudgeStart(-0.5)}>← -0.5s (A)</button>
          <span>{clip.start.toFixed(2)}s</span>
          <button onClick={() => onNudgeStart(0.5)}>+0.5s (D) →</button>
        </div>
      </div>

      <div className="control-group">
        <label>End Time</label>
        <div className="buttons">
          <button onClick={() => onNudgeEnd(-0.5)}>← -0.5s (←)</button>
          <span>{clip.end.toFixed(2)}s</span>
          <button onClick={() => onNudgeEnd(0.5)}>+0.5s (→) →</button>
        </div>
      </div>

      <div className="control-group">
        <label>Duration</label>
        <span>{clip.duration.toFixed(2)}s</span>
      </div>

      <div className="control-group">
        {clip.status === 'trash' ? (
          <button onClick={onRestore} className="restore-btn">
            Restore Clip
          </button>
        ) : (
          <button onClick={onTrash} className="trash-btn">
            Trash Clip (T)
          </button>
        )}
      </div>
    </div>
  )
}
```

**Lines of Code:** ~80 lines

---

### src/components/StatOverlay.tsx

**Purpose:** Live score preview overlay on video

**Key Features:**
- Display current score
- Show team names
- Highlight current server
- Match team colors

```typescript
function StatOverlay({ state, team1, team2 }: Props) {
  if (!state || !team1 || !team2) return null

  return (
    <div className="stat-overlay">
      <div className="score-display">
        <div className="team" style={{ color: team1.color }}>
          <span className="name">{team1.name}</span>
          <span className="score">{state.score[0]}</span>
          {state.server.teamId === team1.id && <span className="serving">●</span>}
        </div>

        <div className="separator">-</div>

        <div className="team" style={{ color: team2.color }}>
          <span className="score">{state.score[1]}</span>
          <span className="name">{team2.name}</span>
          {state.server.teamId === team2.id && <span className="serving">●</span>}
        </div>
      </div>

      <div className="server-info">
        Server: {state.server.name} → {state.receiver.name}
      </div>
    </div>
  )
}
```

**Lines of Code:** ~60 lines

---

### src/components/StatTable.tsx

**Purpose:** Display player statistics and RPR calculations

**Key Features:**
- Calculate stats from clips
- Display RPR breakdown
- Team totals
- Sortable columns

```typescript
function StatTable({ clips, matchSetup, matchFlow }: Props) {
  const stats = useMemo(() => {
    return calculatePlayerStats(clips, matchSetup, matchFlow)
  }, [clips, matchSetup, matchFlow])

  return (
    <div className="stat-table">
      <h3>Player Statistics</h3>

      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>RPR</th>
            <th>Aces</th>
            <th>Serve %</th>
            <th>Hit %</th>
            <th>Errors</th>
            <th>Efficiency</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(stats).map(([playerId, playerStats]) => (
            <tr key={playerId}>
              <td>{matchSetup.team1.players.find(p => p.id === playerId)?.name ||
                   matchSetup.team2.players.find(p => p.id === playerId)?.name}</td>
              <td className="rpr">{playerStats.totalRPR.toFixed(1)}</td>
              <td>{playerStats.aces}</td>
              <td>{playerStats.servePercentage.toFixed(1)}%</td>
              <td>{playerStats.hitPercentage.toFixed(1)}%</td>
              <td>{playerStats.errors}</td>
              <td>{playerStats.efficiencyRPR.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="team-totals">
        <div>
          <h4>{matchSetup.team1.name}</h4>
          <p>Total RPR: {calculateTeamRPR(stats, matchSetup.team1).toFixed(1)}</p>
        </div>
        <div>
          <h4>{matchSetup.team2.name}</h4>
          <p>Total RPR: {calculateTeamRPR(stats, matchSetup.team2).toFixed(1)}</p>
        </div>
      </div>
    </div>
  )
}
```

**Lines of Code:** ~150 lines

---

### src/pages/Export.tsx

**Purpose:** Broadcast studio for final video export

**Key Features:**
- Select overlay template (preset or custom upload)
- Configure score positioning (WYSIWYG editor)
- Upload team logos
- Position logos
- Enable/disable statistics screen
- Set resolution (1080p/720p)
- Generate stat screen image
- Trigger FFmpeg render

**Component Structure:**

```typescript
function Export({ project, onBack }: Props) {
  const [clips, setClips] = useState<Clip[]>([])
  const [matchSetup, setMatchSetup] = useState<MatchSetup | null>(null)
  const [matchFlow, setMatchFlow] = useState<Map<number, RoundnetState>>(new Map())
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    showOverlay: true,
    overlayPath: '',
    textConfig: {
      score1: { x: 400, y: 80, color: '#ffffff' },
      score2: { x: 1400, y: 80, color: '#ffffff' },
      fontSize: 64
    },
    team1Name: '',
    team2Name: '',
    includeNames: true,
    matchFlow: {},
    showStatScreen: true,
    statScreenPath: '',
    statDuration: 10,
    resolution: '1080p',
    logoConfig: {}
  })
  const [isRendering, setIsRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState(0)

  // Load data
  useEffect(() => {
    async function loadData() {
      const clipsData = await window.api.file.readClips(project.id)
      setClips(clipsData.clips.filter(c => c.status !== 'trash'))

      const setup = await window.api.file.readMatchSetup(project.id)
      setMatchSetup(setup)

      if (setup) {
        const flow = calculateMatchFlow(clipsData.clips, setup)
        setMatchFlow(flow)

        setExportConfig(prev => ({
          ...prev,
          team1Name: setup.team1.name,
          team2Name: setup.team2.name,
          matchFlow: Object.fromEntries(flow)
        }))
      }
    }

    loadData()
  }, [project.id])

  async function handleSelectOverlay(variant: 'stacked' | 'top-corners' | 'top-middle' | 'custom') {
    if (variant === 'custom') {
      // TODO: File picker
      return
    }

    const overlayPath = await window.api.export.getOverlayPath(variant)
    if (overlayPath) {
      setExportConfig(prev => ({ ...prev, overlayPath }))
    }
  }

  async function handleUploadLogo(team: 'team1' | 'team2') {
    // File picker
    const filePath = await window.api.dialog.openImage()
    if (!filePath) return

    // Read file as base64
    const base64 = await readFileAsBase64(filePath)

    // Save to project directory
    const savedPath = await window.api.export.saveImage(
      project.id,
      `${team}-logo.png`,
      base64
    )

    setExportConfig(prev => ({
      ...prev,
      logoConfig: {
        ...prev.logoConfig,
        [team]: {
          path: savedPath,
          x: team === 'team1' ? 50 : 1770,
          y: 50,
          width: 100,
          height: 100
        }
      }
    }))
  }

  async function handleGenerateStatScreen() {
    // Render stat table to canvas
    const statElement = document.getElementById('stat-table-preview')
    if (!statElement) return

    const canvas = await html2canvas(statElement)
    const base64 = canvas.toDataURL('image/png')

    // Save to project directory
    const savedPath = await window.api.export.saveImage(
      project.id,
      'stat-screen.png',
      base64.split(',')[1]  // Remove data:image/png;base64, prefix
    )

    setExportConfig(prev => ({
      ...prev,
      statScreenPath: savedPath
    }))

    alert('Statistics screen generated!')
  }

  async function handleExport() {
    if (!exportConfig.overlayPath) {
      alert('Please select an overlay template')
      return
    }

    if (exportConfig.showStatScreen && !exportConfig.statScreenPath) {
      await handleGenerateStatScreen()
    }

    setIsRendering(true)

    const result = await window.api.export.render({
      projectId: project.id,
      clips: clips,
      exportConfig: exportConfig
    })

    if (result.success) {
      alert('Export complete! Video saved to project directory.')
      await window.api.project.update(project.id, { status: 'exported' })
    } else {
      alert(`Export failed: ${result.message}`)
    }

    setIsRendering(false)
  }

  return (
    <div className="export">
      <header>
        <button onClick={onBack}>← Back to Editor</button>
        <h2>Broadcast Studio</h2>
        <button onClick={handleExport} disabled={isRendering}>
          {isRendering ? `Exporting... ${renderProgress}%` : 'Export Video'}
        </button>
      </header>

      {/* Overlay selection */}
      <section className="overlay-section">
        <h3>Overlay Template</h3>
        <div className="overlay-presets">
          <div onClick={() => handleSelectOverlay('stacked')}>
            <img src="/overlays/stacked.png" alt="Stacked" />
            <p>Stacked</p>
          </div>
          <div onClick={() => handleSelectOverlay('top-corners')}>
            <img src="/overlays/top-corners.png" alt="Top Corners" />
            <p>Top Corners</p>
          </div>
          <div onClick={() => handleSelectOverlay('top-middle')}>
            <img src="/overlays/top-middle.png" alt="Top Middle" />
            <p>Top Middle</p>
          </div>
        </div>
      </section>

      {/* Score positioning */}
      <section className="score-config">
        <h3>Score Configuration</h3>
        <div className="config-inputs">
          <label>
            Team 1 Score X:
            <input
              type="number"
              value={exportConfig.textConfig.score1.x}
              onChange={(e) => setExportConfig(prev => ({
                ...prev,
                textConfig: {
                  ...prev.textConfig,
                  score1: { ...prev.textConfig.score1, x: parseInt(e.target.value) }
                }
              }))}
            />
          </label>
          {/* More positioning inputs */}
        </div>
      </section>

      {/* Logo upload */}
      <section className="logo-section">
        <h3>Team Logos</h3>
        <div className="logo-uploads">
          <div>
            <button onClick={() => handleUploadLogo('team1')}>
              Upload {matchSetup?.team1.name} Logo
            </button>
            {exportConfig.logoConfig.team1 && (
              <img src={exportConfig.logoConfig.team1.path} alt="Team 1 logo" />
            )}
          </div>
          <div>
            <button onClick={() => handleUploadLogo('team2')}>
              Upload {matchSetup?.team2.name} Logo
            </button>
            {exportConfig.logoConfig.team2 && (
              <img src={exportConfig.logoConfig.team2.path} alt="Team 2 logo" />
            )}
          </div>
        </div>
      </section>

      {/* Statistics screen */}
      <section className="stat-screen-section">
        <h3>Statistics Screen</h3>
        <label>
          <input
            type="checkbox"
            checked={exportConfig.showStatScreen}
            onChange={(e) => setExportConfig(prev => ({
              ...prev,
              showStatScreen: e.target.checked
            }))}
          />
          Include statistics screen at end
        </label>

        {exportConfig.showStatScreen && (
          <>
            <label>
              Duration (seconds):
              <input
                type="number"
                value={exportConfig.statDuration}
                onChange={(e) => setExportConfig(prev => ({
                  ...prev,
                  statDuration: parseInt(e.target.value)
                }))}
              />
            </label>

            <div id="stat-table-preview">
              <StatTable
                clips={clips}
                matchSetup={matchSetup!}
                matchFlow={matchFlow}
              />
            </div>

            <button onClick={handleGenerateStatScreen}>
              Generate Statistics Screen
            </button>
          </>
        )}
      </section>

      {/* Resolution */}
      <section className="resolution-section">
        <h3>Export Settings</h3>
        <label>
          Resolution:
          <select
            value={exportConfig.resolution}
            onChange={(e) => setExportConfig(prev => ({
              ...prev,
              resolution: e.target.value as '1080p' | '720p'
            }))}
          >
            <option value="1080p">1080p (1920x1080)</option>
            <option value="720p">720p (1280x720)</option>
          </select>
        </label>
      </section>

      {/* Preview */}
      <section className="preview-section">
        <h3>Preview</h3>
        <div className="video-preview">
          {/* Show first clip with overlay */}
        </div>
      </section>
    </div>
  )
}
```

**Lines of Code:** ~500 lines

---

### src/context/MatchContext.tsx

**Purpose:** Global state management for match flow and rotation

**Key Features:**
- Provide match setup to all components
- Calculate match flow from clips
- Update match state based on stat assignments
- Memoize expensive calculations

```typescript
interface MatchContextType {
  matchSetup: MatchSetup | null
  matchFlow: Map<number, RoundnetState>
  setMatchSetup: (setup: MatchSetup) => void
  updateMatchFlow: (clipId: number, statType: StatType, winningTeam: Team) => void
}

const MatchContext = createContext<MatchContextType | undefined>(undefined)

export function MatchContextProvider({ children }: { children: React.ReactNode }) {
  const [matchSetup, setMatchSetup] = useState<MatchSetup | null>(null)
  const [matchFlow, setMatchFlow] = useState<Map<number, RoundnetState>>(new Map())

  const updateMatchFlow = useCallback((clipId: number, statType: StatType, winningTeam: Team) => {
    if (!matchSetup) return

    setMatchFlow(prevFlow => {
      const newFlow = new Map(prevFlow)
      const previousState = newFlow.get(clipId - 1) || getInitialState(matchSetup)

      const newState = calculateNextState(previousState, statType, winningTeam, matchSetup)
      newFlow.set(clipId, newState)

      return newFlow
    })
  }, [matchSetup])

  const value = useMemo(() => ({
    matchSetup,
    matchFlow,
    setMatchSetup,
    updateMatchFlow
  }), [matchSetup, matchFlow, updateMatchFlow])

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>
}

export function useMatchContext() {
  const context = useContext(MatchContext)
  if (!context) {
    throw new Error('useMatchContext must be used within MatchContextProvider')
  }
  return context
}
```

**Lines of Code:** ~100 lines

---

### src/core/rotation.ts

**Purpose:** Match rotation logic calculations

**Key Functions:**

```typescript
export function calculateNextState(
  currentState: RoundnetState,
  statType: StatType,
  winningTeam: Team,
  matchSetup: MatchSetup
): RoundnetState {
  if (matchSetup.servingStyle === 'traditional') {
    return calculateTraditionalRotation(currentState, statType, winningTeam)
  } else {
    return calculateEqualRotation(currentState, statType, winningTeam, matchSetup)
  }
}

function calculateTraditionalRotation(
  state: RoundnetState,
  statType: StatType,
  winningTeam: Team
): RoundnetState {
  const servingTeamWon = (winningTeam === state.servingTeam)
  const newScore = [...state.score]

  if (winningTeam.id === 'team1') {
    newScore[0]++
  } else {
    newScore[1]++
  }

  if (servingTeamWon) {
    // Service break: server swaps sides
    const serverIndex = state.rotation.indexOf(state.server)
    const partnerIndex = (serverIndex + 2) % 4

    return {
      score: newScore,
      server: state.rotation[partnerIndex],
      receiver: state.receiver,
      rotation: state.rotation,
      servingTeam: state.servingTeam,
      serveCount: 0
    }
  } else {
    // Sideout: possession changes
    const receiverIndex = state.rotation.indexOf(state.receiver)
    const isEvenScore = (newScore[0] + newScore[1]) % 2 === 0
    const newServerIndex = isEvenScore ? (receiverIndex + 1) % 4 : (receiverIndex + 3) % 4

    return {
      score: newScore,
      server: state.rotation[newServerIndex],
      receiver: state.server,
      rotation: state.rotation,
      servingTeam: winningTeam,
      serveCount: 0
    }
  }
}

function calculateEqualRotation(
  state: RoundnetState,
  statType: StatType,
  winningTeam: Team,
  matchSetup: MatchSetup
): RoundnetState {
  const newScore = [...state.score]

  if (winningTeam.id === 'team1') {
    newScore[0]++
  } else {
    newScore[1]++
  }

  const isTiebreak = (newScore[0] >= 20 && newScore[1] >= 20)
  const maxServes = isTiebreak ? 1 : (state.serveCount === 0 ? 1 : 2)

  const newServeCount = state.serveCount + 1

  if (newServeCount >= maxServes) {
    // Rotation
    const currentIndex = state.rotation.indexOf(state.server)
    const nextServerIndex = (currentIndex + 1) % 4
    const nextReceiverIndex = (nextServerIndex + 2) % 4

    return {
      score: newScore,
      server: state.rotation[nextServerIndex],
      receiver: state.rotation[nextReceiverIndex],
      rotation: state.rotation,
      servingTeam: determineTeam(state.rotation[nextServerIndex]),
      serveCount: 0
    }
  } else {
    return {
      ...state,
      score: newScore,
      serveCount: newServeCount
    }
  }
}
```

**Lines of Code:** ~200 lines

---

### src/core/stats.ts

**Purpose:** Player statistics calculations

**Key Functions:**

```typescript
export function calculatePlayerStats(
  clips: Clip[],
  matchSetup: MatchSetup,
  matchFlow: Map<number, RoundnetState>
): PlayerStatsMap {
  const stats: PlayerStatsMap = {}

  // Initialize stats for all players
  const allPlayers = [...matchSetup.team1.players, ...matchSetup.team2.players]
  allPlayers.forEach(player => {
    stats[player.id] = {
      aces: 0,
      servesOn: 0,
      totalServes: 0,
      successfulHits: 0,
      totalHits: 0,
      errors: 0,
      acedCount: 0,
      defTouchesReturned: 0,
      defTouchesNotReturned: 0,
      servingRPR: 0,
      hittingRPR: 0,
      efficiencyRPR: 0,
      defenseRPR: 0,
      totalRPR: 0
    }
  })

  // Accumulate stats from clips
  clips.forEach(clip => {
    if (clip.status === 'trash' || !clip.statType) return

    const state = matchFlow.get(clip.id)
    if (!state) return

    switch (clip.statType) {
      case 'ace':
        stats[state.server.id].aces++
        stats[state.server.id].servesOn++
        stats[state.server.id].totalServes++
        stats[state.receiver.id].acedCount++
        break

      case 'service_break':
        stats[state.server.id].servesOn++
        stats[state.server.id].totalServes++
        break

      case 'double_fault':
        stats[state.server.id].errors++
        stats[state.server.id].totalServes++
        break

      case 'hitting_error':
        clip.involvedPlayers.forEach(playerId => {
          stats[playerId].errors++
          stats[playerId].totalHits++
        })
        break

      // More cases...
    }
  })

  // Calculate RPR for each player
  Object.keys(stats).forEach(playerId => {
    const playerStats = stats[playerId]

    // Serving RPR
    const servePercentage = playerStats.totalServes > 0
      ? playerStats.servesOn / playerStats.totalServes
      : 0
    playerStats.servingRPR = 5.5 * playerStats.aces + 15 * servePercentage

    // Hitting RPR
    const hitPercentage = playerStats.totalHits > 0
      ? playerStats.successfulHits / playerStats.totalHits
      : 0
    playerStats.hittingRPR = 20 * hitPercentage

    // Efficiency RPR
    playerStats.efficiencyRPR = 20 - 5 * playerStats.errors - 2 * playerStats.acedCount

    // Defense RPR
    playerStats.defenseRPR =
      0.4 * playerStats.hittingRPR * playerStats.defTouchesReturned +
      playerStats.defTouchesNotReturned

    // Total RPR
    playerStats.totalRPR = 1.57 * (
      playerStats.servingRPR +
      playerStats.hittingRPR +
      playerStats.efficiencyRPR +
      playerStats.defenseRPR
    )
  })

  return stats
}
```

**Lines of Code:** ~150 lines

---

### src/types/match.ts

**Purpose:** TypeScript type definitions

```typescript
export interface Project {
  id: string
  name: string
  videoPath: string
  videoName: string
  zonesFile?: string
  clipsJson?: string
  finalVideo?: string
  createdAt: string
  updatedAt: string
  status: ProjectStatus
  processingProgress?: number
}

export type ProjectStatus = 'new' | 'zones-set' | 'processing' | 'processed' | 'edited' | 'exported'

export interface Clip {
  id: number
  start: number
  end: number
  duration: number
  tag: 'Rally' | 'Serve' | 'Noise'
  confidence: 'High' | 'Medium' | 'Low'
  peak_energy: number
  status: 'pending' | 'done' | 'trash'
  statType: StatType | null
  involvedPlayers: string[]
}

export type StatType =
  | 'ace'
  | 'double_fault'
  | 'service_break'
  | 'side_out'
  | 'hitting_error'
  | 'defensive_dig'
  | 'long_rally'

export interface MatchSetup {
  team1: Team
  team2: Team
  servingStyle: 'traditional' | 'equal'
  targetScore: number
  firstServerId: string
  firstReceiverId: string
}

export interface Team {
  id: string
  name: string
  color: string
  players: Player[]
}

export interface Player {
  id: string
  name: string
  teamId: string
}

export interface RoundnetState {
  score: [number, number]
  server: Player
  receiver: Player
  rotation: Player[]
  servingTeam: Team
  serveCount: number
}

export interface PlayerStats {
  aces: number
  servesOn: number
  totalServes: number
  successfulHits: number
  totalHits: number
  errors: number
  acedCount: number
  defTouchesReturned: number
  defTouchesNotReturned: number
  servingRPR: number
  hittingRPR: number
  efficiencyRPR: number
  defenseRPR: number
  totalRPR: number
}

export type PlayerStatsMap = Record<string, PlayerStats>
```

**Lines of Code:** ~100 lines

---

### src/index.css

**Purpose:** Global styles and TailwindCSS imports

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom CSS variables */
:root {
  --rc-dark: #0f172a;
  --rc-accent: #3b82f6;
  --rc-green: #10b981;
  --rc-yellow: #f59e0b;
  --rc-red: #ef4444;
}

/* Global resets */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background-color: var(--rc-dark);
  color: #ffffff;
  -webkit-font-smoothing: antialiased;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1e293b;
}

::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

/* Electron drag region */
.drag-region {
  -webkit-app-region: drag;
}

.no-drag {
  -webkit-app-region: no-drag;
}

/* Component-specific styles */
.filmstrip {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding: 1rem;
  background: #1e293b;
}

.clip-thumbnail {
  flex-shrink: 0;
  width: 150px;
  height: 100px;
  background: #334155;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}

.clip-thumbnail:hover {
  transform: scale(1.05);
}

.clip-thumbnail.selected {
  border: 3px solid var(--rc-accent);
}

.clip-thumbnail.trashed {
  opacity: 0.4;
  filter: grayscale(100%);
}

/* More component styles... */
```

**Lines of Code:** ~200 lines

---

## Python Backend Files

All files in `python/` are executed as child processes from the main Electron app.

### python/main.py

**Purpose:** CLI entry point for video processing

**Key Responsibilities:**
- Parse command-line arguments
- Initialize YOLO model
- Open video file
- Process frames with detection pipeline
- Output progress to stdout
- Export clips.json

**Argument Parsing:**

```python
import argparse

parser = argparse.ArgumentParser(description='Roundnet video processor')
parser.add_argument('--video', required=True, help='Path to video file')
parser.add_argument('--zones', required=True, help='Path to court_zones.json')
parser.add_argument('--output', required=True, help='Path to output clips.json')
parser.add_argument('--debug', action='store_true', help='Enable debug output')

args = parser.parse_args()
```

**Main Processing Loop:**

```python
import cv2
import json
from core.detection import PoseDetector
from core.state_machine import RallyStateMachine
from core.config import Config

def main():
    # Load zones
    with open(args.zones, 'r') as f:
        zones = json.load(f)

    # Initialize detector
    detector = PoseDetector(Config.MODEL_PATH, Config.DEVICE)

    # Initialize state machine
    state_machine = RallyStateMachine(zones, Config)

    # Open video
    cap = cv2.VideoCapture(args.video)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    frame_count = 0
    clips = []

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Skip frames
        if frame_count % (Config.FRAME_SKIP + 1) != 0:
            frame_count += 1
            continue

        # Detect poses
        detections = detector.detect(frame)

        # Update state machine
        state_machine.update(detections, frame_count / fps)

        # Check for completed rallies
        if state_machine.has_rally():
            rally = state_machine.pop_rally()
            clips.append({
                'id': len(clips) + 1,
                'start': rally['start_time'],
                'end': rally['end_time'],
                'duration': rally['end_time'] - rally['start_time'],
                'tag': rally['tag'],
                'confidence': rally['confidence'],
                'peak_energy': rally['peak_energy'],
                'status': 'pending',
                'statType': None,
                'involvedPlayers': []
            })

        # Print progress
        progress = int((frame_count / total_frames) * 100)
        print(f"Progress: {progress}% ({frame_count}/{total_frames})")

        frame_count += 1

    cap.release()

    # Export clips
    output_data = {
        'clips': clips,
        'metadata': {
            'video_path': args.video,
            'total_frames': total_frames,
            'fps': fps,
            'duration': total_frames / fps,
            'processing_date': datetime.now().isoformat()
        }
    }

    with open(args.output, 'w') as f:
        json.dump(output_data, f, indent=2)

    print(f"Processing complete! {len(clips)} clips detected.")

if __name__ == '__main__':
    main()
```

**Lines of Code:** ~200 lines

---

### python/core/detection.py

**Purpose:** YOLO pose detection wrapper

**Key Responsibilities:**
- Load YOLOv8 model
- Run batch inference
- Extract keypoints from results
- Handle GPU/CPU device selection

```python
import torch
from ultralytics import YOLO
import numpy as np

class PoseDetector:
    def __init__(self, model_path: str, device: str = 'auto'):
        """
        Initialize pose detector.

        Args:
            model_path: Path to YOLOv8 model weights
            device: 'auto', 'cpu', 'cuda', or 'mps'
        """
        self.model = YOLO(model_path)

        # Auto-detect device
        if device == 'auto':
            if torch.cuda.is_available():
                device = 'cuda'
            elif torch.backends.mps.is_available():
                device = 'mps'
            else:
                device = 'cpu'

        self.device = device
        self.model.to(device)

    def detect(self, frame: np.ndarray, batch: list = None) -> list:
        """
        Detect poses in frame or batch of frames.

        Args:
            frame: Single frame (H, W, 3) or None if using batch
            batch: List of frames for batch processing

        Returns:
            List of detections, each containing:
            - keypoints: (17, 3) array [x, y, confidence]
            - bbox: (x1, y1, x2, y2)
            - confidence: float
        """
        input_data = batch if batch is not None else [frame]

        # Run inference
        results = self.model.predict(
            input_data,
            device=self.device,
            half=True,  # FP16 precision
            verbose=False
        )

        # Extract detections
        all_detections = []

        for result in results:
            frame_detections = []

            if result.keypoints is None:
                all_detections.append(frame_detections)
                continue

            keypoints = result.keypoints.data.cpu().numpy()  # (num_persons, 17, 3)
            boxes = result.boxes.data.cpu().numpy()          # (num_persons, 6)

            for i in range(len(keypoints)):
                frame_detections.append({
                    'keypoints': keypoints[i],  # (17, 3)
                    'bbox': boxes[i][:4],       # (x1, y1, x2, y2)
                    'confidence': boxes[i][4]   # Detection confidence
                })

            all_detections.append(frame_detections)

        return all_detections[0] if batch is None else all_detections
```

**Lines of Code:** ~100 lines

---

### python/core/state_machine.py

**Purpose:** Rally detection finite state machine

**Key Responsibilities:**
- Implement 4-state FSM (SEARCHING, LOCKED, PROBATION, RALLY)
- Track zone occupancy
- Measure baseline energy
- Detect rally start/end
- Output rally clips with metadata

```python
from enum import Enum
from dataclasses import dataclass
import numpy as np
from .utils import point_in_zone, calculate_energy

class RallyState(Enum):
    SEARCHING = 1
    LOCKED = 2
    PROBATION = 3
    RALLY = 4

@dataclass
class Rally:
    start_time: float
    end_time: float
    peak_energy: float
    tag: str
    confidence: str

class RallyStateMachine:
    def __init__(self, zones: list, config):
        """
        Initialize state machine.

        Args:
            zones: List of 4 zone polygons [[x,y], ...]
            config: Configuration object with thresholds
        """
        self.zones = [np.array(zone, dtype=np.int32) for zone in zones]
        self.config = config
        self.state = RallyState.SEARCHING
        self.completed_rallies = []

        # State tracking
        self.zone_occupancy = {i: None for i in range(4)}  # Zone -> person_id
        self.baseline_energy = 0.0
        self.rally_start_time = 0.0
        self.rally_peak_energy = 0.0
        self.low_energy_frames = 0
        self.locked_frames = 0

        # History for smoothing
        self.previous_keypoints = {}

    def update(self, detections: list, timestamp: float):
        """
        Update state machine with new detections.

        Args:
            detections: List of person detections with keypoints
            timestamp: Current video timestamp (seconds)
        """
        # Calculate zone occupancy
        current_occupancy = self._calculate_occupancy(detections)

        # Calculate movement energy
        energy = self._calculate_total_energy(detections)

        # State machine logic
        if self.state == RallyState.SEARCHING:
            self._handle_searching(current_occupancy, timestamp)

        elif self.state == RallyState.LOCKED:
            self._handle_locked(current_occupancy, energy, timestamp)

        elif self.state == RallyState.PROBATION:
            self._handle_probation(energy, timestamp)

        elif self.state == RallyState.RALLY:
            self._handle_rally(energy, timestamp)

        # Update history
        self.zone_occupancy = current_occupancy
        self.previous_keypoints = {i: det['keypoints'] for i, det in enumerate(detections)}

    def _calculate_occupancy(self, detections: list) -> dict:
        """Determine which person is in which zone."""
        occupancy = {i: None for i in range(4)}

        for person_id, det in enumerate(detections):
            keypoints = det['keypoints']

            # Use hip midpoint as person center
            left_hip = keypoints[11][:2]
            right_hip = keypoints[12][:2]
            center = ((left_hip[0] + right_hip[0]) / 2, (left_hip[1] + right_hip[1]) / 2)

            # Check which zone contains center
            for zone_id, zone in enumerate(self.zones):
                if point_in_zone(center, zone):
                    occupancy[zone_id] = person_id
                    break

        return occupancy

    def _calculate_total_energy(self, detections: list) -> float:
        """Calculate total movement energy across all players."""
        total_energy = 0.0

        for person_id, det in enumerate(detections):
            if person_id not in self.previous_keypoints:
                continue

            energy = calculate_energy(
                det['keypoints'],
                self.previous_keypoints[person_id]
            )
            total_energy += energy

        # Smooth with exponential moving average
        smoothed = 0.7 * total_energy + 0.3 * getattr(self, 'prev_energy', total_energy)
        self.prev_energy = smoothed

        return smoothed

    def _handle_searching(self, occupancy: dict, timestamp: float):
        """SEARCHING state: Wait for ≥2 zones occupied."""
        occupied_count = sum(1 for v in occupancy.values() if v is not None)

        if occupied_count >= 2:
            self.locked_frames += 1

            if self.locked_frames >= self.config.LOCKED_MIN_FRAMES:
                self.state = RallyState.LOCKED
                self.baseline_energy = 0.0
                self.locked_frames = 0
        else:
            self.locked_frames = 0

    def _handle_locked(self, occupancy: dict, energy: float, timestamp: float):
        """LOCKED state: Measure baseline, detect serve."""
        occupied_count = sum(1 for v in occupancy.values() if v is not None)

        if occupied_count < 2:
            # Players left zones - serve detected
            self.state = RallyState.PROBATION
            self.rally_start_time = timestamp - self.config.PRE_SERVE_BUFFER
            self.rally_peak_energy = 0.0
            return

        # Update baseline energy (running average)
        self.baseline_energy = 0.8 * self.baseline_energy + 0.2 * energy

    def _handle_probation(self, energy: float, timestamp: float):
        """PROBATION state: Validate rally duration."""
        self.rally_peak_energy = max(self.rally_peak_energy, energy)

        # Check if enough time has passed
        duration = timestamp - self.rally_start_time

        if duration >= self.config.MIN_RALLY_DURATION:
            # Check if energy spiked above threshold
            threshold = self._calculate_threshold()

            if self.rally_peak_energy > threshold:
                self.state = RallyState.RALLY
            else:
                # False positive, back to searching
                self.state = RallyState.SEARCHING
                self.locked_frames = 0

    def _handle_rally(self, energy: float, timestamp: float):
        """RALLY state: Detect rally end."""
        self.rally_peak_energy = max(self.rally_peak_energy, energy)

        threshold = self._calculate_threshold()

        if energy < threshold * 0.5:  # 50% of threshold
            self.low_energy_frames += 1

            if self.low_energy_frames >= self.config.LOW_ENERGY_MIN_FRAMES:
                # Rally ended
                rally_end = timestamp - self.config.POST_POINT_BUFFER

                self._emit_rally(self.rally_start_time, rally_end, self.rally_peak_energy)

                self.state = RallyState.SEARCHING
                self.low_energy_frames = 0
                self.locked_frames = 0
        else:
            self.low_energy_frames = 0  # Reset counter (occlusion protection)

    def _calculate_threshold(self) -> float:
        """Calculate dynamic energy threshold."""
        threshold = self.baseline_energy + self.config.BASE_SENSITIVITY

        # Clamp to safety rails
        return max(
            self.config.MIN_THRESHOLD,
            min(threshold, self.config.MAX_THRESHOLD)
        )

    def _emit_rally(self, start: float, end: float, peak: float):
        """Create rally clip and classify."""
        duration = end - start

        # Classify by peak energy
        if peak > 85:
            tag = 'Rally'
            confidence = 'High'
        elif peak > 70:
            tag = 'Rally'
            confidence = 'Medium'
        elif duration > 5.0:
            tag = 'Serve'
            confidence = 'Medium'
        else:
            tag = 'Noise'
            confidence = 'Low'

        self.completed_rallies.append(Rally(
            start_time=start,
            end_time=end,
            peak_energy=peak,
            tag=tag,
            confidence=confidence
        ))

    def has_rally(self) -> bool:
        """Check if any rallies are ready to be retrieved."""
        return len(self.completed_rallies) > 0

    def pop_rally(self) -> dict:
        """Get oldest completed rally."""
        rally = self.completed_rallies.pop(0)
        return {
            'start_time': rally.start_time,
            'end_time': rally.end_time,
            'peak_energy': rally.peak_energy,
            'tag': rally.tag,
            'confidence': rally.confidence
        }
```

**Lines of Code:** ~300 lines

---

### python/core/config.py

**Purpose:** Configuration parameters for detection algorithm

```python
class Config:
    # Model
    MODEL_PATH = 'yolov8n-pose.pt'
    DEVICE = 'auto'  # auto, cpu, cuda, mps

    # Processing
    FRAME_SKIP = 2           # Process every 3rd frame
    PROCESS_WIDTH = 640      # Downscale width for inference
    BATCH_SIZE = 4           # Frames per batch

    # State machine
    LOCKED_MIN_FRAMES = 75   # 2.5s at 30fps
    MIN_RALLY_DURATION = 2.5  # seconds
    LOW_ENERGY_MIN_FRAMES = 75  # 2.5s grace period

    # Energy calculation
    BASE_SENSITIVITY = 60.0
    MIN_THRESHOLD = 45.0     # Safety floor
    MAX_THRESHOLD = 80.0     # Safety ceiling

    # Buffers
    PRE_SERVE_BUFFER = 4.0   # seconds before serve
    POST_POINT_BUFFER = -1.0  # seconds after point (negative = trim)

    # Keypoint indices (YOLO pose format)
    IMPORTANT_KEYPOINTS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
    # Nose=0, LEye=1, REye=2, LEar=3, REar=4,
    # LShoulder=5, RShoulder=6, LElbow=7, RElbow=8,
    # LWrist=9, RWrist=10, LHip=11, RHip=12,
    # LKnee=13, RKnee=14, LAnkle=15, RAnkle=16
```

**Lines of Code:** ~40 lines

---

### python/core/utils.py

**Purpose:** Helper functions

```python
import cv2
import numpy as np

def point_in_zone(point: tuple, zone: np.ndarray) -> bool:
    """
    Check if point is inside polygon zone.

    Args:
        point: (x, y) coordinates
        zone: (N, 2) array of polygon vertices

    Returns:
        bool: True if point inside zone
    """
    result = cv2.pointPolygonTest(zone, point, False)
    return result >= 0

def calculate_energy(keypoints: np.ndarray, prev_keypoints: np.ndarray) -> float:
    """
    Calculate movement energy between frames.

    Args:
        keypoints: (17, 3) array [x, y, conf]
        prev_keypoints: (17, 3) array from previous frame

    Returns:
        float: Energy score (0-100+)
    """
    from core.config import Config

    energy = 0.0

    for i in Config.IMPORTANT_KEYPOINTS:
        x, y, conf = keypoints[i]
        px, py, pconf = prev_keypoints[i]

        # Require minimum confidence
        if conf < 0.5 or pconf < 0.5:
            continue

        # Euclidean distance
        dx = x - px
        dy = y - py
        movement = np.sqrt(dx**2 + dy**2)

        # Weight by confidence
        weighted = movement * min(conf, pconf)
        energy += weighted

    # Normalize (empirically tuned)
    return min(energy * 3.5, 100.0)
```

**Lines of Code:** ~60 lines

---

### python/tools/renderer.py

**Purpose:** FFmpeg video export

**Key Responsibilities:**
- Build FFmpeg filter_complex command
- Render clips with overlays, logos, text
- Handle encoder fallback
- Progress reporting

```python
import subprocess
import json

def render_video(clips: list, export_config: dict, output_path: str):
    """
    Render final highlight video with FFmpeg.

    Args:
        clips: List of clip dictionaries
        export_config: Export configuration
        output_path: Path to save output video

    Returns:
        bool: True if successful
    """
    video_path = export_config['videoPath']
    overlay_path = export_config.get('overlayPath')

    # Build FFmpeg command
    cmd = ['ffmpeg', '-y']  # Overwrite output

    # Input: source video (referenced multiple times)
    cmd.extend(['-i', video_path])

    # Input: overlay image
    if overlay_path:
        cmd.extend(['-i', overlay_path])

    # Build filter complex
    filters = []
    for i, clip in enumerate(clips):
        # Trim video segment
        filters.append(
            f"[0:v]trim=start={clip['start']}:end={clip['end']},"
            f"setpts=PTS-STARTPTS[v{i}]"
        )

        # Trim audio segment
        filters.append(
            f"[0:a]atrim=start={clip['start']}:end={clip['end']},"
            f"asetpts=PTS-STARTPTS[a{i}]"
        )

        # Scale if needed
        if export_config.get('resolution') == '720p':
            filters.append(f"[v{i}]scale=1280:720[v{i}_scaled]")
        else:
            filters.append(f"[v{i}]null[v{i}_scaled]")  # Pass through

        # Overlay graphic
        if overlay_path:
            filters.append(
                f"[v{i}_scaled][1:v]overlay=0:0[v{i}_final]"
            )
        else:
            filters.append(f"[v{i}_scaled]null[v{i}_final]")

    # Concatenate all clips
    concat_v = ''.join([f"[v{i}_final]" for i in range(len(clips))])
    concat_a = ''.join([f"[a{i}]" for i in range(len(clips))])
    filters.append(
        f"{concat_v}{concat_a}concat=n={len(clips)}:v=1:a=1[outv][outa]"
    )

    # Add filter_complex
    cmd.extend(['-filter_complex', ';'.join(filters)])

    # Map outputs
    cmd.extend(['-map', '[outv]', '-map', '[outa]'])

    # Encoding
    encoders = ['h264_videotoolbox', 'libx264']

    for encoder in encoders:
        try:
            enc_cmd = cmd + [
                '-c:v', encoder,
                '-b:v', '8M',
                '-c:a', 'aac',
                '-b:a', '192k',
                output_path
            ]

            subprocess.run(enc_cmd, check=True, stderr=subprocess.PIPE)
            return True  # Success

        except subprocess.CalledProcessError as e:
            if encoder == encoders[-1]:  # Last encoder failed
                raise Exception(f"FFmpeg failed: {e.stderr.decode()}")
            continue  # Try next encoder

    return False
```

**Lines of Code:** ~150 lines

---

## Configuration Files

### package.json

**Purpose:** NPM project configuration

**Key Sections:**

```json
{
  "name": "roundnet-condenser",
  "version": "1.0.0",
  "main": "dist-electron/main.js",
  "type": "module",
  "scripts": {
    "dev": "node build-preload.js && vite",
    "build": "tsc && vite build && node build-preload.js && electron-builder",
    "electron:dev": "electron ."
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "html-to-image": "^1.11.13"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "electron": "^33.2.0",
    "electron-builder": "^25.1.8",
    "tailwindcss": "^3.4.16",
    "typescript": "^5.6.3",
    "vite": "^6.0.3",
    "vite-plugin-electron": "^0.28.8"
  },
  "build": {
    "appId": "com.roundnet.condenser",
    "productName": "Roundnet Condenser",
    "files": [
      "dist/**/*",
      "dist-electron/**/*",
      "public/**/*",
      "yolov8n-pose.pt"
    ],
    "mac": {
      "category": "public.app-category.video",
      "target": "dmg"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

**Lines of Code:** ~80 lines

---

### tsconfig.json

**Purpose:** TypeScript compiler configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "electron"]
}
```

---

### vite.config.ts

**Purpose:** Vite build configuration

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron({
      entry: 'electron/main.ts'
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})
```

---

### tailwind.config.js

**Purpose:** TailwindCSS configuration

```javascript
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'rc-dark': '#0f172a',
        'rc-accent': '#3b82f6',
        'rc-green': '#10b981',
        'rc-yellow': '#f59e0b',
        'rc-red': '#ef4444'
      }
    }
  },
  plugins: []
}
```

---

## Assets & Static Files

### public/overlays/

**Contains:** Preset overlay templates
- `stacked.png` - Score overlay with stacked design
- `top-corners.png` - Score in top corners
- `top-middle.png` - Score in top center

**Format:** PNG with alpha channel (transparent background)
**Resolution:** 1920x1080

### yolov8n-pose.pt

**Purpose:** YOLOv8 pose detection model weights
**Size:** 6.5MB
**Format:** PyTorch model file
**Usage:** Loaded by `python/core/detection.py`

---

## File Dependency Graph

```
main.ts
├── preload.ts (loaded as script)
├── project-manager.ts (imported)
└── python-runner.ts (imported)

App.tsx
├── Dashboard.tsx
│   └── window.api.* (from preload)
├── ZoneWizard.tsx
│   └── window.api.*
├── MatchSetupWizard.tsx
│   ├── window.api.*
│   └── types/match.ts
├── Editor.tsx
│   ├── window.api.*
│   ├── types/match.ts
│   ├── core/rotation.ts
│   ├── core/stats.ts
│   ├── NudgeControls.tsx
│   ├── StatOverlay.tsx
│   └── StatTable.tsx
└── Export.tsx
    ├── window.api.*
    ├── types/match.ts
    ├── core/stats.ts
    ├── StatTable.tsx
    └── html-to-image (npm package)

main.py
├── core/detection.py
│   ├── ultralytics (YOLO)
│   └── torch (PyTorch)
├── core/state_machine.py
│   ├── core/config.py
│   └── core/utils.py
├── core/config.py
└── tools/renderer.py
    └── subprocess (FFmpeg)
```

---

**Last Updated:** 2026-02-16
**Total Files Documented:** 40+
**Total Lines of Code:** ~7,000
