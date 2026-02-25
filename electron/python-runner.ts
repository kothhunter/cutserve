import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { app, BrowserWindow } from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * PythonRunner – spawns and manages the Python backend processes.
 *
 * In development: runs `python python/main.py` directly.
 * In production (packaged via PyInstaller): runs the bundled executable.
 *
 * Two independent process slots:
 * - detectionProcess: video detection / clip extraction
 * - renderProcess: video export / rendering
 * Both can run concurrently.
 */

interface ProcessingArgs {
  projectId: string
  videoPath: string
  zonesFile: string
  outputJson: string
  options?: Record<string, unknown>
}

interface ProcessingStatus {
  running: boolean
  progress?: number
  currentFrame?: number
  totalFrames?: number
}

export class PythonRunner {
  private detectionProcess: ChildProcess | null = null
  private renderProcess: ChildProcess | null = null
  private status: ProcessingStatus = { running: false }

  /**
   * Kill a child process in a platform-appropriate way.
   * On Windows, SIGTERM is not reliable — use taskkill instead.
   */
  private killProcess(proc: ChildProcess): void {
    if (process.platform === 'win32') {
      // On Windows, spawn taskkill to forcefully end the process tree
      if (proc.pid) {
        spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t'], { stdio: 'ignore' })
      }
    } else {
      proc.kill('SIGTERM')
    }
  }

  /**
   * Get the path to the Python executable / script.
   * In dev mode: uses the python/ folder directly.
   * In production: uses the PyInstaller-bundled binary.
   */
  private getPythonPath(): { command: string; args: string[] } {
    if (app.isPackaged) {
      // Production: PyInstaller binary
      const binName = process.platform === 'win32' ? 'roundnet-engine.exe' : 'roundnet-engine'
      const binPath = path.join(process.resourcesPath, 'python', binName)
      return { command: binPath, args: [] }
    } else {
      // Development: run Python script directly
      // Use -u flag to unbuffer output so we see it in real-time
      const scriptPath = path.join(__dirname, '..', 'python', 'main.py')
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      return { command: pythonCmd, args: ['-u', scriptPath] }
    }
  }

  /**
   * Start video processing by spawning the Python engine.
   */
  async startProcessing(args: ProcessingArgs): Promise<{ success: boolean; message: string }> {
    if (this.detectionProcess) {
      return { success: false, message: 'Processing is already running' }
    }

    const { projectId } = args

    try {
      const { command, args: baseArgs } = this.getPythonPath()

      // Build command-line arguments for the Python script
      const processArgs = [
        ...baseArgs,
        args.videoPath,
        '-z', args.zonesFile,
        '-o', args.outputJson,
        '--debug',
      ]

      // In production, the model weights are bundled to resources/python/
      if (app.isPackaged) {
        const modelPath = path.join(process.resourcesPath, 'python', 'yolov8n-pose.pt')
        processArgs.push('--model', modelPath)
      }

      // Add any extra options
      if (args.options?.fast) {
        processArgs.push('--fast')
      }

      console.log(`[PythonRunner] Starting: ${command} ${processArgs.join(' ')}`)
      console.log(`[PythonRunner] Working directory:`, process.cwd())

      this.detectionProcess = spawn(command, processArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }, // Unbuffer Python output
      })

      this.status = { running: true, progress: 0 }

      const stderrChunks: string[] = []

      // Stream stdout for progress updates
      this.detectionProcess.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim()
        console.log(`[Python] ${line}`)
        this.parseProgress(line, projectId)
      })

      // Stream stderr for errors (buffer for error reporting on failure)
      this.detectionProcess.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim()
        console.error(`[Python ERROR] ${line}`)
        stderrChunks.push(line)
      })

      // Handle process exit
      this.detectionProcess.on('close', (code: number | null) => {
        console.log(`[PythonRunner] Process exited with code ${code}`)
        this.status = { running: false }
        this.detectionProcess = null

        // Notify renderer
        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
          if (code === 0) {
            windows[0].webContents.send('python:complete', {
              projectId,
              outputPath: args.outputJson,
            })
          } else {
            const stderrText = stderrChunks.length > 0
              ? stderrChunks.join('\n').trim()
              : `Process exited with code ${code}`
            windows[0].webContents.send('python:error', { projectId, error: stderrText })
          }
        }
      })

      this.detectionProcess.on('error', (err: Error) => {
        console.error(`[PythonRunner] Failed to start: ${err.message}`)
        this.status = { running: false }
        this.detectionProcess = null

        // Notify renderer so the UI doesn't hang forever
        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
          windows[0].webContents.send('python:error', {
            projectId,
            error: `Failed to start processing engine: ${err.message}`,
          })
        }
      })

      return { success: true, message: 'Processing started' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { success: false, message }
    }
  }

  /**
   * Parse progress output from the Python script's stdout.
   * Expected format: [  25.3%] Frame 1234/5000 (120.5 FPS)
   */
  private parseProgress(line: string, projectId: string) {
    const progressMatch = line.match(/\[\s*([\d.]+)%\]\s*Frame\s+(\d+)\/(\d+)/)
    if (progressMatch) {
      const progress = parseFloat(progressMatch[1])
      const currentFrame = parseInt(progressMatch[2], 10)
      const totalFrames = parseInt(progressMatch[3], 10)

      this.status = { running: true, progress, currentFrame, totalFrames }

      // Send progress to renderer
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        windows[0].webContents.send('python:progress', {
          projectId,
          progress,
          frame: currentFrame,
          total: totalFrames,
        })
      }
    }
  }

  /**
   * Stop the currently running detection process.
   */
  async stopProcessing(): Promise<{ success: boolean }> {
    if (this.detectionProcess) {
      this.killProcess(this.detectionProcess)
      this.detectionProcess = null
      this.status = { running: false }
      return { success: true }
    }
    return { success: false }
  }

  /**
   * Get current processing status.
   */
  getStatus(): ProcessingStatus {
    return { ...this.status }
  }

  /**
   * Run the video renderer to export final highlights.
   */
  async runRenderer(args: {
    projectId: string
    videoPath: string
    clipsPath: string
    outputPath: string
    config?: Record<string, unknown>
  }): Promise<{ success: boolean; message: string }> {
    if (this.renderProcess) {
      return { success: false, message: 'A render is already running' }
    }

    const { projectId } = args

    try {
      let command: string
      let processArgs: string[]

      if (app.isPackaged) {
        // Production: use bundled PyInstaller binary
        const binName = process.platform === 'win32' ? 'roundnet-renderer.exe' : 'roundnet-renderer'
        command = path.join(process.resourcesPath, 'python', binName)
        const ffmpegDir = path.join(process.resourcesPath, 'ffmpeg')
        processArgs = [
          '--video', args.videoPath,
          '--clips', args.clipsPath,
          '--output', args.outputPath,
          '--ffmpeg-dir', ffmpegDir,
        ]
      } else {
        // Development: run Python script directly
        const scriptPath = path.join(__dirname, '..', 'python', 'tools', 'renderer.py')
        command = process.platform === 'win32' ? 'python' : 'python3'
        processArgs = [
          scriptPath,
          '--video', args.videoPath,
          '--clips', args.clipsPath,
          '--output', args.outputPath,
        ]
      }

      if (args.config) {
        const configPath = path.join(path.dirname(args.clipsPath), 'export-config.json')
        const fs = await import('fs/promises')
        await fs.writeFile(configPath, JSON.stringify(args.config))
        processArgs.push('--config', configPath)
      }

      console.log(`[PythonRunner] Starting renderer: ${command} ${processArgs.join(' ')}`)

      // Ensure ffmpeg is findable on PATH
      const pathEnv = process.env.PATH || ''
      const extraPaths: string[] = []
      if (process.platform === 'darwin') {
        // Prefer Homebrew ffmpeg (has drawtext support)
        extraPaths.push('/opt/homebrew/bin', '/usr/local/bin')
      }
      // In production, also add the bundled ffmpeg directory
      if (app.isPackaged) {
        extraPaths.push(path.join(process.resourcesPath, 'ffmpeg'))
      }
      const pathSet = new Set(extraPaths)
      pathEnv.split(path.delimiter).forEach((p) => pathSet.add(p))
      const envWithPath = { ...process.env, PATH: [...pathSet].join(path.delimiter) }

      this.renderProcess = spawn(command, processArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: envWithPath,
      })

      const stderrChunks: string[] = []

      // Stream stdout
      this.renderProcess.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim()
        console.log(`[Renderer] ${line}`)
      })

      // Stream stderr (buffer so we can show user on failure)
      this.renderProcess.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim()
        console.error(`[Renderer ERROR] ${line}`)
        stderrChunks.push(line)
      })

      // Handle process exit
      this.renderProcess.on('close', (code: number | null) => {
        console.log(`[PythonRunner] Renderer exited with code ${code}`)
        this.renderProcess = null

        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
          if (code === 0) {
            windows[0].webContents.send('render:complete', {
              projectId,
              outputPath: args.outputPath,
            })
          } else {
            const stderrText = stderrChunks.length > 0
              ? stderrChunks.join('\n').trim()
              : `Renderer exited with code ${code}`
            windows[0].webContents.send('render:error', { projectId, error: stderrText })
          }
        }
      })

      this.renderProcess.on('error', (err: Error) => {
        console.error(`[PythonRunner] Failed to start renderer: ${err.message}`)
        this.renderProcess = null

        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
          windows[0].webContents.send('render:error', {
            projectId,
            error: `Failed to start renderer: ${err.message}`,
          })
        }
      })

      return { success: true, message: 'Rendering started' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { success: false, message }
    }
  }

  cancelRenderer(): { success: boolean; message: string } {
    if (!this.renderProcess) {
      return { success: false, message: 'No renderer process running' }
    }
    this.killProcess(this.renderProcess)
    this.renderProcess = null
    return { success: true, message: 'Renderer cancelled' }
  }

  /**
   * Stop all running processes (called on app quit).
   */
  stopAll(): void {
    if (this.detectionProcess) {
      this.killProcess(this.detectionProcess)
      this.detectionProcess = null
    }
    if (this.renderProcess) {
      this.killProcess(this.renderProcess)
      this.renderProcess = null
    }
    this.status = { running: false }
  }
}
