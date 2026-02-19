import { contextBridge, ipcRenderer } from 'electron'

/**
 * Preload script – the secure bridge between the React UI and Electron/Python.
 *
 * This exposes a typed `window.api` object that React components use
 * to communicate with the main process (and by extension, the Python engine).
 */

export interface Project {
  id: string
  name: string
  videoPath: string
  videoName: string
  zonesFile?: string
  clipsJson?: string
  clipsEditedJson?: string
  finalVideo?: string
  createdAt: string
  updatedAt: string
  status: 'new' | 'zones-set' | 'processing' | 'processed' | 'edited' | 'exported'
  processingProgress?: number
}

// Types for the exposed API
export interface RoundnetAPI {
  // Python engine commands
  startProcessing: (args: {
    videoPath: string
    zonesFile: string
    outputJson: string
    options?: Record<string, unknown>
  }) => Promise<{ success: boolean; message: string }>

  stopProcessing: () => Promise<{ success: boolean }>

  getStatus: () => Promise<{
    running: boolean
    progress?: number
    currentFrame?: number
    totalFrames?: number
  }>

  // Dialog helpers
  openVideoDialog: () => Promise<string | null>
  showSaveHighlightsDialog: (defaultPath: string) => Promise<string | null>

  // Event listeners for real-time progress from Python
  onProgress: (callback: (data: { progress: number; frame: number; total: number }) => void) => void
  onProcessingComplete: (callback: (data: { clips: unknown[]; outputPath: string }) => void) => void
  onProcessingError: (callback: (error: string) => void) => void
  
  // Project management
  listProjects: () => Promise<Project[]>
  createProject: (videoPath: string, name?: string) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  getProjectDir: (id: string) => Promise<string>
  getVideoUrl: (projectId: string) => Promise<string | null>

  // File operations
  writeZones: (projectId: string, zones: any[]) => Promise<string>
  readClips: (projectId: string) => Promise<any>
  saveEditedClips: (projectId: string, clipsData: any) => Promise<string>
  readMatchSetup: (projectId: string) => Promise<unknown>
  writeMatchSetup: (projectId: string, setup: unknown) => Promise<string>
  
  // Export / Rendering
  renderHighlights: (args: {
    projectId: string
    videoPath: string
    clipsPath: string
    outputPath: string
    config?: Record<string, unknown>
  }) => Promise<{ success: boolean; message: string }>
  onRenderComplete: (callback: (data: { outputPath: string }) => void) => void
  onRenderError: (callback: (error: string) => void) => void
  saveExportImage: (projectId: string, filename: string, base64Data: string) => Promise<string>
  getOverlayPath: (variant: string) => Promise<string | null>
  getFontPath: (filename: string) => Promise<string | null>

  // Auth
  auth: {
    restore: () => Promise<boolean>
    register: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
    logout: () => Promise<void>
    getProfile: () => Promise<{
      id: string
      email: string
      plan: 'free' | 'pro' | 'lifetime'
      exports_this_month: number
      exports_reset_at: string
    } | null>
    canExport: () => Promise<{ allowed: boolean; used: number; limit: number }>
    recordExport: () => Promise<void>
  }

  // Shell
  openExternal: (url: string) => Promise<void>
}

contextBridge.exposeInMainWorld('api', {
  // ── Python Engine Commands ──────────────────────────────────────────
  startProcessing: (args: {
    videoPath: string
    zonesFile: string
    outputJson: string
    options?: Record<string, unknown>
  }) => ipcRenderer.invoke('python:start-processing', args),

  stopProcessing: () => ipcRenderer.invoke('python:stop-processing'),

  getStatus: () => ipcRenderer.invoke('python:get-status'),

  // ── Dialog Helpers ──────────────────────────────────────────────────
  openVideoDialog: () => ipcRenderer.invoke('dialog:open-video'),
  showSaveHighlightsDialog: (defaultPath: string) =>
    ipcRenderer.invoke('dialog:save-highlights', defaultPath),

  // ── Event Listeners (Python → React) ───────────────────────────────
  onProgress: (callback: (data: { progress: number; frame: number; total: number }) => void) => {
    ipcRenderer.on('python:progress', (_event, data) => callback(data))
  },

  onProcessingComplete: (callback: (data: { clips: unknown[]; outputPath: string }) => void) => {
    ipcRenderer.on('python:complete', (_event, data) => callback(data))
  },

  onProcessingError: (callback: (error: string) => void) => {
    ipcRenderer.on('python:error', (_event, error) => callback(error))
  },
  
  // ── Project Management ──────────────────────────────────────────────
  listProjects: () => ipcRenderer.invoke('project:list'),
  
  createProject: (videoPath: string, name?: string) => 
    ipcRenderer.invoke('project:create', videoPath, name),
  
  updateProject: (id: string, updates: any) => 
    ipcRenderer.invoke('project:update', id, updates),
  
  deleteProject: (id: string) => 
    ipcRenderer.invoke('project:delete', id),
  
  getProjectDir: (id: string) => 
    ipcRenderer.invoke('project:get-dir', id),

  getVideoUrl: (projectId: string) =>
    ipcRenderer.invoke('video:get-url', projectId),
  
  // ── File Operations ─────────────────────────────────────────────────
  writeZones: (projectId: string, zones: any[]) => 
    ipcRenderer.invoke('file:write-zones', projectId, zones),
  
  readClips: (projectId: string) => 
    ipcRenderer.invoke('file:read-clips', projectId),
  
  saveEditedClips: (projectId: string, clipsData: any) => 
    ipcRenderer.invoke('file:save-edited-clips', projectId, clipsData),

  readMatchSetup: (projectId: string) =>
    ipcRenderer.invoke('file:read-match-setup', projectId),

  writeMatchSetup: (projectId: string, setup: unknown) =>
    ipcRenderer.invoke('file:write-match-setup', projectId, setup),
  
  // ── Export / Rendering ──────────────────────────────────────────────
  renderHighlights: (args: {
    projectId: string
    videoPath: string
    clipsPath: string
    outputPath: string
    config?: Record<string, unknown>
  }) => ipcRenderer.invoke('export:render', args),
  
  onRenderComplete: (callback: (data: { outputPath: string }) => void) => {
    ipcRenderer.on('render:complete', (_event, data) => callback(data))
  },
  
  onRenderError: (callback: (error: string) => void) => {
    ipcRenderer.on('render:error', (_event, error) => callback(error))
  },

  saveExportImage: (projectId: string, filename: string, base64Data: string) =>
    ipcRenderer.invoke('export:save-image', projectId, filename, base64Data),

  getOverlayPath: (variant: string) =>
    ipcRenderer.invoke('export:get-overlay-path', variant),

  getFontPath: (filename: string) =>
    ipcRenderer.invoke('export:get-font-path', filename),

  // ── Auth ────────────────────────────────────────────────────────────────
  auth: {
    restore:      ()                              => ipcRenderer.invoke('auth:restore'),
    register:     (email: string, password: string) => ipcRenderer.invoke('auth:register', email, password),
    login:        (email: string, password: string) => ipcRenderer.invoke('auth:login', email, password),
    logout:       ()                              => ipcRenderer.invoke('auth:logout'),
    getProfile:   ()                              => ipcRenderer.invoke('auth:get-profile'),
    canExport:    ()                              => ipcRenderer.invoke('auth:can-export'),
    recordExport: ()                              => ipcRenderer.invoke('auth:record-export'),
  },

  // ── Shell ────────────────────────────────────────────────────────────────
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
} satisfies RoundnetAPI)
