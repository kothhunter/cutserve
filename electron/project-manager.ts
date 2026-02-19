import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'

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

export class ProjectManager {
  private projectsFile: string
  private projectsDir: string
  /** Serialize all reads/writes to projects.json to prevent concurrent corruption */
  private fileLock: Promise<void> = Promise.resolve()

  constructor() {
    const userData    = app.getPath('userData')
    this.projectsFile = path.join(userData, 'projects.json')
    this.projectsDir  = path.join(userData, 'projects')
  }

  async init() {
    try {
      console.log('[ProjectManager] userData:', app.getPath('userData'))
      console.log('[ProjectManager] projects file:', this.projectsFile)
      console.log('[ProjectManager] projects dir:', this.projectsDir)

      // Ensure the storage directories exist
      await fs.mkdir(path.dirname(this.projectsFile), { recursive: true })
      await fs.mkdir(this.projectsDir, { recursive: true })

      // ── One-time project directory migration ──────────────────────
      // Move any project folders from the old ~/Documents/CutServe Projects/ location
      // into the new userData/projects/ location so nothing gets lost.
      await this.migrateProjectDirsFromDocuments()

      // ── Migration (first run only) ────────────────────────────────
      // Only migrate if projects.json does NOT exist yet.
      // Using file existence (not empty-array check) prevents migration from
      // re-running after the user intentionally deletes all their projects.
      const projectsFileExists = await fs.access(this.projectsFile).then(() => true).catch(() => false)

      if (!projectsFileExists) {
        await this.migrateFromLegacy()
      }

      // ── Self-heal ────────────────────────────────────────────────
      // Remove any JSON entries whose project directory no longer exists.
      // Catches projects deleted externally, or entries left behind after a
      // failed delete that only removed the directory but not the JSON entry.
      await this.pruneStaleProjects()

      console.log('[ProjectManager] Initialization complete')
    } catch (error) {
      console.error('[ProjectManager] Initialization failed:', error)
      throw error
    }
  }

  // ── Migration ──────────────────────────────────────────────────────

  /** Move project folders from ~/Documents/CutServe Projects/ into userData/projects/. */
  private async migrateProjectDirsFromDocuments(): Promise<void> {
    const oldDir = path.join(app.getPath('documents'), 'CutServe Projects')
    const oldDirExists = await fs.access(oldDir).then(() => true).catch(() => false)
    if (!oldDirExists) return

    try {
      const entries = await fs.readdir(oldDir, { withFileTypes: true })
      let moved = 0
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const src  = path.join(oldDir, entry.name)
        const dest = path.join(this.projectsDir, entry.name)
        const destExists = await fs.access(dest).then(() => true).catch(() => false)
        if (!destExists) {
          await fs.rename(src, dest).catch(async () => {
            // rename fails across volumes — fall back to copy + delete
            await fs.cp(src, dest, { recursive: true })
            await fs.rm(src, { recursive: true, force: true })
          })
          moved++
        }
      }
      if (moved > 0) {
        console.log(`[ProjectManager] Moved ${moved} project folder(s) from Documents to userData`)
      }
      // Remove the old directory if it's now empty
      const remaining = await fs.readdir(oldDir)
      if (remaining.length === 0) {
        await fs.rmdir(oldDir).catch(() => {})
      }
    } catch (err) {
      console.warn('[ProjectManager] Could not migrate project dirs from Documents:', err)
    }
  }

  /** Try to import projects.json from previous app-name directories, then blank the source. */
  private async migrateFromLegacy(): Promise<void> {
    const appSupportDir = path.dirname(app.getPath('userData'))

    // Checked in reverse-chronological rename order
    for (const legacyName of ['cut-serve', 'roundnet-condenser', 'Electron']) {
      const legacyFile = path.join(appSupportDir, legacyName, 'projects.json')
      try {
        const raw = await fs.readFile(legacyFile, 'utf-8')
        const parsed = this.parseJson(raw)
        const projects = Array.isArray(parsed?.projects) ? parsed.projects : []

        // Write to the canonical location — even if empty, so we don't migrate again
        await fs.writeFile(this.projectsFile, JSON.stringify({ projects }, null, 2))

        // Blank the legacy file so deleted projects can never be re-imported
        await fs.writeFile(legacyFile, JSON.stringify({ projects: [] }, null, 2)).catch(() => {})

        if (projects.length > 0) {
          console.log(`[ProjectManager] Migrated ${projects.length} project(s) from ${legacyFile}`)
        } else {
          console.log(`[ProjectManager] Legacy file at ${legacyFile} was empty — started fresh`)
        }
        return // Stop after the first readable legacy file
      } catch {
        // No readable file at this path — try the next one
      }
    }

    // No legacy data found — fresh install
    await fs.writeFile(this.projectsFile, JSON.stringify({ projects: [] }, null, 2))
    console.log('[ProjectManager] Fresh install — created projects.json')
  }

  // ── Self-healing ───────────────────────────────────────────────────

  /** Remove JSON entries whose project directory is missing from disk. */
  private async pruneStaleProjects(): Promise<void> {
    return this.withLock(async () => {
      const projects = await this.readProjectsFile()
      const valid: Project[] = []

      for (const p of projects) {
        const dirExists = await fs.access(this.getProjectDir(p.id)).then(() => true).catch(() => false)
        if (dirExists) {
          valid.push(p)
        } else {
          console.log(`[ProjectManager] Pruned stale entry "${p.name}" (${p.id}) — directory missing`)
        }
      }

      if (valid.length !== projects.length) {
        await fs.writeFile(this.projectsFile, JSON.stringify({ projects: valid }, null, 2))
        console.log(`[ProjectManager] Pruned ${projects.length - valid.length} stale project(s)`)
      }
    })
  }

  // ── File lock ──────────────────────────────────────────────────────

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.fileLock
    let resolve!: () => void
    this.fileLock = new Promise((r) => { resolve = r })
    try {
      await prev
      return await fn()
    } finally {
      resolve()
    }
  }

  // ── JSON parsing (with corruption recovery) ───────────────────────

  private parseJson(data: string): { projects: Project[] } | null {
    try {
      return JSON.parse(data)
    } catch {
      // Corrupted file: try to extract the first complete JSON object
      const firstBrace = data.indexOf('{')
      if (firstBrace === -1) return null
      let depth = 0, end = firstBrace
      for (let i = firstBrace; i < data.length; i++) {
        if (data[i] === '{') depth++
        else if (data[i] === '}') { depth--; if (depth === 0) { end = i + 1; break } }
      }
      if (end <= firstBrace) return null
      try {
        return JSON.parse(data.slice(firstBrace, end))
      } catch {
        return null
      }
    }
  }

  private async readProjectsFile(): Promise<Project[]> {
    try {
      const data = await fs.readFile(this.projectsFile, 'utf-8')
      const parsed = this.parseJson(data)
      if (!parsed) {
        console.warn('[ProjectManager] Could not parse projects.json — resetting')
        await fs.writeFile(this.projectsFile, JSON.stringify({ projects: [] }, null, 2))
        return []
      }
      return Array.isArray(parsed.projects) ? parsed.projects : []
    } catch {
      // File doesn't exist yet — return empty (init should have created it, but be defensive)
      return []
    }
  }

  // ── Public API ────────────────────────────────────────────────────

  async listProjects(): Promise<Project[]> {
    return this.withLock(() => this.readProjectsFile())
  }

  async createProject(videoPath: string, name?: string): Promise<Project> {
    return this.withLock(async () => {
      const id        = Date.now().toString()
      const videoName = path.basename(videoPath)
      const project: Project = {
        id,
        name:       name || videoName.replace(/\.[^/.]+$/, ''),
        videoPath:  path.resolve(videoPath),
        videoName,
        createdAt:  new Date().toISOString(),
        updatedAt:  new Date().toISOString(),
        status:     'new',
      }

      const projectDir = this.getProjectDir(id)
      await fs.mkdir(projectDir, { recursive: true })

      const projects = await this.readProjectsFile()
      projects.push(project)
      await fs.writeFile(this.projectsFile, JSON.stringify({ projects }, null, 2))

      console.log(`[ProjectManager] Created project "${project.name}" (${id})`)
      return project
    })
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    return this.withLock(async () => {
      const projects = await this.readProjectsFile()
      const index = projects.findIndex(p => p.id === id)
      if (index === -1) throw new Error(`Project not found: ${id}`)

      projects[index] = { ...projects[index], ...updates, updatedAt: new Date().toISOString() }
      await fs.writeFile(this.projectsFile, JSON.stringify({ projects }, null, 2))
      return projects[index]
    })
  }

  async deleteProject(id: string): Promise<void> {
    return this.withLock(async () => {
      const projects = await this.readProjectsFile()
      const filtered = projects.filter(p => p.id !== id)

      // Write the updated list first — if the directory removal fails,
      // the JSON is already clean and pruneStaleProjects will handle it next launch.
      await fs.writeFile(this.projectsFile, JSON.stringify({ projects: filtered }, null, 2))

      const projectDir = this.getProjectDir(id)
      await fs.rm(projectDir, { recursive: true, force: true })

      console.log(`[ProjectManager] Deleted project ${id}`)
    })
  }

  // ── Path helpers ──────────────────────────────────────────────────

  getProjectDir(id: string): string {
    return path.join(this.projectsDir, id)
  }

  getZonesPath(id: string): string {
    return path.join(this.getProjectDir(id), 'court_zones.json')
  }

  getClipsPath(id: string): string {
    return path.join(this.getProjectDir(id), 'clips.json')
  }

  getEditedClipsPath(id: string): string {
    return path.join(this.getProjectDir(id), 'clips_edited.json')
  }

  getExportPath(id: string): string {
    return path.join(this.getProjectDir(id), 'final_highlights.mp4')
  }

  getMatchSetupPath(id: string): string {
    return path.join(this.getProjectDir(id), 'match-setup.json')
  }
}
