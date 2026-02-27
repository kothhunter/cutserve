import { useRef, useState, useEffect } from 'react'
import type { Project } from '../App'
import { toVideoUrl } from '../utils/video-url'

interface Point { x: number; y: number }
interface Zone  { points: Point[]; completed: boolean }

interface ZoneWizardProps {
  project: Project
  onComplete: () => void
}

export function ZoneWizard({ project, onComplete }: ZoneWizardProps) {
  const videoRef     = useRef<HTMLVideoElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [currentTime, setCurrentTime] = useState(120)
  const [duration, setDuration]       = useState(0)
  const [zones, setZones]             = useState<Zone[]>([])
  const [currentZone, setCurrentZone] = useState<Point[]>([])
  const [canvasSize, setCanvasSize]   = useState({ width: 0, height: 0 })
  const [saving, setSaving]           = useState(false)
  const [videoError, setVideoError]   = useState<string | null>(null)

  const maxScrubTime     = Math.min(duration, 600)
  const completedZones   = zones.filter(z => z.completed).length

  // ── Canvas size sync with video ─────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    const updateCanvasSize = () => {
      if (video && canvasRef.current) {
        const rect = video.getBoundingClientRect()
        canvasRef.current.width  = rect.width
        canvasRef.current.height = rect.height
        setCanvasSize({ width: rect.width, height: rect.height })
      }
    }

    const handleLoadedMetadata = () => {
      updateCanvasSize()
      if (video) {
        setDuration(video.duration)
        video.currentTime = 120
        setVideoError(null)
      }
    }

    video?.addEventListener('loadedmetadata', handleLoadedMetadata)
    window.addEventListener('resize', updateCanvasSize)
    return () => {
      video?.removeEventListener('loadedmetadata', handleLoadedMetadata)
      window.removeEventListener('resize', updateCanvasSize)
    }
  }, [])

  // ── Redraw whenever zones change ────────────────────────────────
  useEffect(() => { drawZones() }, [zones, currentZone, canvasSize])

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    if (videoRef.current) { videoRef.current.currentTime = time; videoRef.current.pause() }
  }

  // ── Canvas click → add point / complete zone ────────────────────
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (completedZones >= 4) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const pt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top }

    if (currentZone.length < 3) {
      setCurrentZone([...currentZone, pt])
    } else {
      setZones([...zones, { points: [...currentZone, pt], completed: true }])
      setCurrentZone([])
    }
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setCurrentZone([])
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      if (currentZone.length > 0) setCurrentZone(currentZone.slice(0, -1))
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentZone, zones])

  // ── Canvas drawing ──────────────────────────────────────────────
  const drawZones = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Neon green for visibility on video
    const neonGreen = '#39ff14'
    const neonGreenFill = 'rgba(57, 255, 20, 0.22)'

    // Completed zones
    zones.forEach((zone, index) => {
      ctx.beginPath()
      ctx.moveTo(zone.points[0].x, zone.points[0].y)
      zone.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      ctx.closePath()
      ctx.fillStyle   = neonGreenFill
      ctx.fill()
      ctx.strokeStyle = neonGreen
      ctx.lineWidth   = 2
      ctx.stroke()

      // Zone number label
      const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length
      const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length
      ctx.fillStyle  = '#0a0a0a'
      ctx.font       = 'bold 20px sans-serif'
      ctx.textAlign  = 'center'
      ctx.fillText(`${index + 1}`, cx, cy)

      // Vertices
      zone.points.forEach(pt => {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2)
        ctx.fillStyle = neonGreen
        ctx.fill()
      })
    })

    // In-progress zone
    if (currentZone.length > 0) {
      ctx.beginPath()
      ctx.moveTo(currentZone[0].x, currentZone[0].y)
      currentZone.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      ctx.strokeStyle = neonGreen
      ctx.lineWidth   = 2
      ctx.stroke()

      currentZone.forEach((pt, i) => {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2)
        ctx.fillStyle = neonGreen
        ctx.fill()
      })
    }
  }

  // ── Save zones + continue ───────────────────────────────────────
  const handleContinue = async () => {
    if (completedZones < 4) { alert('Please draw all 4 zones before continuing'); return }
    setSaving(true)
    try {
      const video = videoRef.current
      if (!video) return
      const scaleX = video.videoWidth  / canvasSize.width
      const scaleY = video.videoHeight / canvasSize.height
      const zonesData = zones.map(z => ({ points: z.points.map(p => ({ x: Math.round(p.x * scaleX), y: Math.round(p.y * scaleY) })) }))
      await window.api.writeZones(project.id, zonesData)
      onComplete()
    } catch { alert('Failed to save zones') }
    finally  { setSaving(false) }
  }

  const handleUndo = () => {
    if (currentZone.length > 0) setCurrentZone(currentZone.slice(0, -1))
    else if (zones.length > 0)  setZones(zones.slice(0, -1))
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col min-h-0 bg-cut-base text-cut-deep">

      {/* ── Sub-header ───────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-cut-warm/40 px-6 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-cut-deep">Zone Setup</h2>
          <p className="text-sm text-cut-mid mt-0.5">Click four corners to form trapezoids around each serving position</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-cut-mid">{completedZones}/4 zones drawn</span>
          {(completedZones > 0 || currentZone.length > 0) && (
            <button
              onClick={handleUndo}
              className="h-9 px-4 text-sm font-medium border border-cut-warm/40 text-cut-mid hover:bg-cut-base hover:text-cut-deep rounded-lg transition-colors"
            >
              Undo
            </button>
          )}
          <button
            onClick={handleContinue}
            disabled={completedZones < 4 || saving}
            className={`h-9 px-5 text-sm font-semibold rounded-lg transition-colors ${
              completedZones >= 4 && !saving
                ? 'bg-cut-deep text-cut-base hover:bg-cut-deep/90'
                : 'bg-cut-warm/30 text-cut-muted cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving…' : 'Continue →'}
          </button>
        </div>
      </div>

      {/* ── Main area: [Zone Status L] [Video] [Zone Status R] ── */}
      <div className="flex-1 flex min-h-0">

        {/* Left zone status panel */}
        <div className="w-36 flex-shrink-0 bg-cut-warm/10 border-r border-cut-warm/30 p-3 flex flex-col gap-3 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cut-muted">Zone Status</p>
          {[0, 1].map(i => (
            <div
              key={i}
              className={`p-3 rounded-xl border text-xs transition-colors ${
                zones[i]?.completed
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-white border-cut-warm/30 text-cut-muted'
              }`}
            >
              <div className="font-semibold mb-0.5">Zone {i + 1}</div>
              <div>{zones[i]?.completed ? '✓ Set' : 'Not set'}</div>
            </div>
          ))}
        </div>

        {/* Video + Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center bg-gray-900 relative overflow-hidden min-w-0"
        >
          <video
            ref={videoRef}
            src={project.videoPath ? toVideoUrl(project.videoPath) : undefined}
            className="max-w-full max-h-full"
            muted
            onError={(e) => {
              const el = e.currentTarget
              const code = el.error?.code
              const msg = el.error?.message || 'Unknown error'
              console.error('[ZoneWizard] Video load error:', { code, msg, src: el.src })
              if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                setVideoError('This video format is not supported. iPhone videos recorded in HEVC (H.265) may not play on Windows. Try converting to H.264 with HandBrake or VLC first.')
              } else {
                setVideoError(`Video failed to load (error ${code}): ${msg}`)
              }
            }}
          />
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="absolute cursor-crosshair"
            style={{ pointerEvents: completedZones >= 4 ? 'none' : 'auto' }}
          />

          {/* Instruction overlay */}
          {completedZones < 4 && (
            <div className="absolute top-3 left-3 bg-black/70 text-cut-base px-3 py-1.5 rounded-lg text-xs">
              {currentZone.length === 0
                ? `Click to start Zone ${completedZones + 1}`
                : `Point ${currentZone.length}/4  ·  Click to add  ·  ESC to cancel`}
            </div>
          )}

          {/* Zone count indicator */}
          <div className="absolute top-3 right-3 bg-black/70 text-cut-base px-3 py-1.5 rounded-lg text-xs font-medium">
            {completedZones}/4 zones
          </div>

          {/* Video error banner */}
          {videoError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="max-w-md mx-4 bg-red-900/90 border border-red-500/50 text-white rounded-xl p-5 text-center">
                <p className="text-sm font-semibold mb-2">Video could not be loaded</p>
                <p className="text-xs text-red-200 leading-relaxed">{videoError}</p>
              </div>
            </div>
          )}

          {/* All done banner */}
          {completedZones === 4 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-lg">
              All 4 zones set — ready to continue!
            </div>
          )}
        </div>

        {/* Right zone status panel */}
        <div className="w-36 flex-shrink-0 bg-cut-warm/10 border-l border-cut-warm/30 p-3 flex flex-col gap-3 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cut-muted">Zone Status</p>
          {[2, 3].map(i => (
            <div
              key={i}
              className={`p-3 rounded-xl border text-xs transition-colors ${
                zones[i]?.completed
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-white border-cut-warm/30 text-cut-muted'
              }`}
            >
              <div className="font-semibold mb-0.5">Zone {i + 1}</div>
              <div>{zones[i]?.completed ? '✓ Set' : 'Not set'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Frame Picker ─────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-t border-cut-warm/40 px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-cut-deep">Frame Picker</span>
          <span className="text-sm font-mono text-cut-mid">
            {formatTimestamp(currentTime)} / {formatTimestamp(maxScrubTime)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={maxScrubTime}
          step={0.1}
          value={currentTime}
          onChange={handleScrub}
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-cut-deep"
          style={{ background: `linear-gradient(to right, #252323 ${(currentTime / Math.max(maxScrubTime, 1)) * 100}%, #dad2bc ${(currentTime / Math.max(maxScrubTime, 1)) * 100}%)` }}
        />
      </div>

      {/* ── Steps ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-cut-base px-6 py-3">
        <div className="grid grid-cols-4 gap-3">
          {[
            { step: '1', text: 'Scrub to a frame with clear starting positions' },
            { step: '2', text: 'Select four corners to form a trapezoid (be generous with coverage)' },
            { step: '3', text: 'Draw all 4 starting zones.' },
            { step: '4', text: 'Continue to Auto Condensing!!!' },
          ].map(({ step, text }) => (
            <div
              key={step}
              className="flex items-start gap-3 p-3 bg-white rounded-xl border border-cut-warm/30"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cut-deep text-cut-base text-xs font-bold flex items-center justify-center mt-0.5">
                {step}
              </span>
              <p className="text-xs text-cut-mid leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
