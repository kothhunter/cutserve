import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'
import type { Project, Clip } from '../App'
import type { MatchSetup } from '../types/match'
import type { BackgroundJob } from '../components/BackgroundJobsBar'
import { StatTable } from '../components/StatTable'
import { StatOverlay } from '../components/StatOverlay'
import { useMatchContext } from '../context/MatchContext'
import { calculateStats } from '../core/stats'
import { toVideoUrl } from '../utils/video-url'

type TemplateId = 'minimal' | 'names' | 'custom'
type Variant = 'top-middle' | 'top-corners' | 'stacked'

const FONT_OPTIONS = [
  { label: 'Inter', regular: 'Inter-Regular.ttf', bold: 'Inter-Bold.ttf' },
  { label: 'Roboto', regular: 'Roboto-Regular.ttf', bold: 'Roboto-Bold.ttf' },
  { label: 'Oswald', regular: 'Oswald-Regular.ttf', bold: 'Oswald-Bold.ttf' },
  { label: 'Bebas Neue', regular: 'BebasNeue-Regular.ttf', bold: 'BebasNeue-Bold.ttf' },
  { label: 'Montserrat', regular: 'Montserrat-Regular.ttf', bold: 'Montserrat-Bold.ttf' },
] as const

/** Overlay image paths for each variant (in public/overlays/) */
const OVERLAY_PATHS: Record<Variant, string> = {
  'top-middle': 'overlays/top-middle.png',
  'top-corners': 'overlays/top-corners.png',
  stacked: 'overlays/stacked.png',
}

interface LogoConfig {
  x: number
  y: number
  width: number
  height: number
}

interface TextConfig {
  score1: { x: number; y: number; color: string }
  score2: { x: number; y: number; color: string }
  name1: { x: number; y: number; color: string; fontSize: number }
  name2: { x: number; y: number; color: string; fontSize: number }
  fontSize: number
}

const DEFAULT_TEXT_CONFIG: TextConfig = {
  score1: { x: 400, y: 80, color: '#ffffff' },
  score2: { x: 1400, y: 80, color: '#ffffff' },
  name1: { x: 200, y: 60, color: '#e2e8f0', fontSize: 65 },
  name2: { x: 1500, y: 60, color: '#e2e8f0', fontSize: 65 },
  fontSize: 64,
}

/** Preset text configs for each template + variant */
const PRESETS: Record<Exclude<TemplateId, 'custom'>, Record<Variant, TextConfig>> = {
  minimal: {
    'top-middle': {
      score1: { x: 825, y: 70, color: '#000000' },
      score2: { x: 1100, y: 70, color: '#000000' },
      name1: { x: 200, y: 60, color: '#94a3b8', fontSize: 65 },
      name2: { x: 1520, y: 60, color: '#94a3b8', fontSize: 65 },
      fontSize: 125,
    },
    'top-corners': {
      score1: { x: 100, y: 80, color: '#000000' },
      score2: { x: 1820, y: 80, color: '#000000' },
      name1: { x: 80, y: 120, color: '#94a3b8', fontSize: 65 },
      name2: { x: 1720, y: 120, color: '#94a3b8', fontSize: 65 },
      fontSize: 125,
    },
    stacked: {
      score1: { x: 275, y: 80, color: '#000000' },
      score2: { x: 275, y: 230, color: '#000000' },
      name1: { x: 120, y: 140, color: '#94a3b8', fontSize: 65 },
      name2: { x: 1680, y: 140, color: '#94a3b8', fontSize: 65 },
      fontSize: 125,
    },
  },
  names: {
    'top-middle': {
      score1: { x: 825, y: 70, color: '#000000' },
      score2: { x: 1100, y: 70, color: '#000000' },
      name1: { x: 500, y: 70, color: '#000000', fontSize: 80 },
      name2: { x: 1520, y: 70, color: '#000000', fontSize: 80 },
      fontSize: 125,
    },
    'top-corners': {
      score1: { x: 100, y: 80, color: '#000000' },
      score2: { x: 1820, y: 80, color: '#000000' },
      name1: { x: 350, y: 55, color: '#000000', fontSize: 80 },
      name2: { x: 1550, y: 55, color: '#000000', fontSize: 80 },
      fontSize: 125,
    },
    stacked: {
      score1: { x: 100, y: 75, color: '#000000' },
      score2: { x: 100, y: 200, color: '#000000' },
      name1: { x: 400, y: 75, color: '#000000', fontSize: 72 },
      name2: { x: 400, y: 200, color: '#000000', fontSize: 72 },
      fontSize: 125,
    },
  },
}

/** Logo position/size presets per variant (1920×1080 coordinate space) */
const LOGO_PRESETS: Record<Variant, { logo1: LogoConfig; logo2: LogoConfig }> = {
  'top-middle': {
    logo1: { x: 675, y: 75, width: 110, height: 110 },
    logo2: { x: 1250, y: 75, width: 110, height: 110 },
  },
  'top-corners': {
    logo1: { x: 275, y: 80, width: 125, height: 125 },
    logo2: { x: 1645, y: 80, width: 125, height: 125 },
  },
  stacked: {
    logo1: { x: 100, y: 80, width: 125, height: 125 },
    logo2: { x: 100, y: 230, width: 125, height: 125 },
  },
}

interface ExportProps {
  project: Project
  matchSetup: MatchSetup
  clips: Clip[]
  onBack: () => void
  backgroundJobs: BackgroundJob[]
  onStartExport: (projectId: string, projectName: string, renderArgs: { videoPath: string; clipsPath: string; outputPath: string; config?: Record<string, unknown> }) => Promise<void>
}

export function Export({ project, matchSetup, clips, onBack, backgroundJobs, onStartExport }: ExportProps) {
  const { matchFlow } = useMatchContext()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [templateId, setTemplateId] = useState<TemplateId>('minimal')
  const [variant, setVariant] = useState<Variant>('top-middle')
  const [customOverlay, setCustomOverlay] = useState<File | null>(null)
  const [customOverlayUrl, setCustomOverlayUrl] = useState<string | null>(null)
  const [textConfig, setTextConfig] = useState<TextConfig>(() => ({
    ...DEFAULT_TEXT_CONFIG,
    ...PRESETS.minimal['top-middle'],
  }))
  const [logoConfig, setLogoConfig] = useState<{ logo1: LogoConfig; logo2: LogoConfig }>(
    () => LOGO_PRESETS['top-middle']
  )
  const [team1Logo, setTeam1Logo] = useState<File | null>(null)
  const [team2Logo, setTeam2Logo] = useState<File | null>(null)
  const [team1LogoUrl, setTeam1LogoUrl] = useState<string | null>(null)
  const [team2LogoUrl, setTeam2LogoUrl] = useState<string | null>(null)
  const [customIncludeLogos, setCustomIncludeLogos] = useState(true)
  const [customIncludeNames, setCustomIncludeNames] = useState(true)
  const [fontFamily, setFontFamily] = useState('Inter')
  const [showOverlay, setShowOverlay] = useState(true)
  const [showStatScreen, setShowStatScreen] = useState(true)
  const [statDuration, setStatDuration] = useState(10)
  const [statBackground, setStatBackground] = useState<'black' | 'blur'>('black')
  const [resolution, setResolution] = useState<string>('1080p')
  const [fps, setFps] = useState<string>('source')
  const [activeTab, setActiveTab] = useState<'overlay' | 'stat' | 'export'>('overlay')
  const [previewMode, setPreviewMode] = useState<'live' | 'stat'>('live')
  const [exportError, setExportError] = useState<string | null>(null)
  const [isCapturingStatScreen, setIsCapturingStatScreen] = useState(false)
  const [previewScale, setPreviewScale] = useState(1)
  const videoRef = useRef<HTMLVideoElement>(null)
  const statCaptureRef = useRef<HTMLDivElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)

  // Derive exporting state from background jobs
  const exportJob = backgroundJobs.find(j => j.type === 'exporting' && j.projectId === project.id)
  const exporting = !!exportJob

  const stats = calculateStats(matchSetup, clips, matchFlow)
  const players = [...matchSetup.team1.players, ...matchSetup.team2.players]

  // Generate @font-face CSS for bundled fonts (preview uses these via public/ paths)
  const fontFaceCss = FONT_OPTIONS.map((f) => `
    @font-face { font-family: '${f.label}'; font-weight: 400; src: url('fonts/${f.regular}') format('truetype'); }
    @font-face { font-family: '${f.label}'; font-weight: 700; src: url('fonts/${f.bold}') format('truetype'); }
  `).join('\n')

  useEffect(() => {
    if (templateId !== 'custom' && templateId in PRESETS) {
      const preset = PRESETS[templateId as Exclude<TemplateId, 'custom'>][variant]
      setTextConfig({ ...preset })
      setLogoConfig({ ...LOGO_PRESETS[variant] })
    }
  }, [templateId, variant])

  // Scale overlay text to the preview container (viewing window), not the full app window
  useEffect(() => {
    const el = previewContainerRef.current
    if (!el) return
    const updateScale = () => {
      const h = el.offsetHeight
      setPreviewScale(h > 0 ? h / 1080 : 1)
    }
    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleTeam1LogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setTeam1Logo(file)
      setTeam1LogoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(file)
      })
    }
    e.target.value = ''
  }

  const handleTeam2LogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setTeam2Logo(file)
      setTeam2LogoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(file)
      })
    }
    e.target.value = ''
  }

  const handleCustomOverlayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCustomOverlay(file)
      const url = URL.createObjectURL(file)
      setCustomOverlayUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
    }
    e.target.value = ''
  }

  const updateTextConfig = (key: keyof TextConfig, value: TextConfig[keyof TextConfig]) => {
    setTextConfig((prev) => ({ ...prev, [key]: value }))
  }

  const updateTextConfigPoint = (
    key: 'score1' | 'score2' | 'name1' | 'name2',
    coord: 'x' | 'y',
    val: number
  ) => {
    setTextConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], [coord]: val },
    }))
  }

  const updateTextConfigColor = (
    key: 'score1' | 'score2' | 'name1' | 'name2',
    color: string
  ) => {
    setTextConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], color },
    }))
  }

  const updateNameFontSize = (key: 'name1' | 'name2', fontSize: number) => {
    setTextConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], fontSize },
    }))
  }

  const updateLogoConfig = (
    key: 'logo1' | 'logo2',
    field: keyof LogoConfig,
    value: number
  ) => {
    setLogoConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const handleExportStudio = useCallback(async () => {
    const keptClips = clips.filter((c) => c.status !== 'trash' && c.keep !== false)
    if (keptClips.length === 0) {
      alert('No clips to export. Add or restore clips in the Editor first.')
      return
    }

    setExportError(null)

    try {
      // 1. Save clips
      const clipsData = {
        video_path: project.videoPath,
        clips,
      }
      await window.api.saveEditedClips(project.id, clipsData)

      // 2. Build match flow for per-clip scores
      const matchFlowObj: Record<string, { team1Score: number; team2Score: number }> = {}
      matchFlow.forEach((state, clipId) => {
        if (clipId !== '_final') {
          matchFlowObj[clipId] = {
            team1Score: state.team1Score,
            team2Score: state.team2Score,
          }
        }
      })

      // 3. Resolve overlay path
      let overlayPath: string | null = null
      if (showOverlay) {
        if (templateId === 'custom' && customOverlay) {
          const buf = await customOverlay.arrayBuffer()
          const base64 = btoa(
            new Uint8Array(buf).reduce((acc, b) => acc + String.fromCharCode(b), '')
          )
          overlayPath = await window.api.saveExportImage(
            project.id,
            'custom-overlay.png',
            `data:image/png;base64,${base64}`
          )
        } else if (templateId !== 'custom') {
          overlayPath = await window.api.getOverlayPath(variant)
        }
      }

      // 4. Capture stat screen if needed (portal mounts only during capture so preview is never covered)
      let statScreenPath: string | null = null
      if (showStatScreen) {
        try {
          setIsCapturingStatScreen(true)
          await new Promise((r) => setTimeout(r, 350))
          if (statCaptureRef.current) {
            const resDims: Record<string, [number, number]> = {
              '720p': [1280, 720], '1080p': [1920, 1080],
              '1440p': [2560, 1440], '4k': [3840, 2160],
            }
            const [capW, capH] = resDims[resolution] ?? [1920, 1080]
            const dataUrl = await toPng(statCaptureRef.current, {
              width: capW,
              height: capH,
              backgroundColor: statBackground === 'black' ? '#000000' : 'rgba(0,0,0,0.3)',
              pixelRatio: 1,
              cacheBust: true,
            })
            if (dataUrl && dataUrl.startsWith('data:image')) {
              statScreenPath = await window.api.saveExportImage(
                project.id,
                'stat-screen.png',
                dataUrl
              )
            } else {
              console.warn('[Export] Stat screen capture produced invalid data URL')
            }
          } else {
            console.warn('[Export] statCaptureRef not mounted - stat screen will be skipped')
          }
        } catch (e) {
          console.error('[Export] Stat screen capture failed:', e)
        } finally {
          setIsCapturingStatScreen(false)
        }
      }

      // 5. Save logos if needed (for overlay compositing)
      let team1LogoPath: string | null = null
      let team2LogoPath: string | null = null
      const includeLogos = (templateId === 'minimal') || (templateId === 'custom' && customIncludeLogos)
      if (showOverlay && includeLogos) {
        if (team1Logo) {
          const buf = await team1Logo.arrayBuffer()
          const base64 = btoa(
            new Uint8Array(buf).reduce((acc, b) => acc + String.fromCharCode(b), '')
          )
          const mime = team1Logo.type?.startsWith('image/') ? team1Logo.type : 'image/png'
          const ext = mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '.png'
          team1LogoPath = await window.api.saveExportImage(
            project.id,
            `team1-logo${ext}`,
            `data:${mime};base64,${base64}`
          )
        }
        if (team2Logo) {
          const buf = await team2Logo.arrayBuffer()
          const base64 = btoa(
            new Uint8Array(buf).reduce((acc, b) => acc + String.fromCharCode(b), '')
          )
          const mime = team2Logo.type?.startsWith('image/') ? team2Logo.type : 'image/png'
          const ext = mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '.png'
          team2LogoPath = await window.api.saveExportImage(
            project.id,
            `team2-logo${ext}`,
            `data:${mime};base64,${base64}`
          )
        }
      }

      // 6. Resolve font paths for renderer
      const fontOption = FONT_OPTIONS.find((f) => f.label === fontFamily) || FONT_OPTIONS[0]
      const scoreFontPath = await window.api.getFontPath(fontOption.bold)
      const nameFontPath = await window.api.getFontPath(fontOption.regular)

      // 7. Build config
      const config: Record<string, unknown> = {
        showOverlay: !!showOverlay,
        overlayPath,
        textConfig,
        team1Name: matchSetup.team1.name,
        team2Name: matchSetup.team2.name,
        includeNames: templateId === 'names' || (templateId === 'custom' && customIncludeNames),
        matchFlow: matchFlowObj,
        showStatScreen: !!showStatScreen,
        statScreenPath,
        statDuration,
        resolution,
        fps,
        logoConfig,
        team1LogoPath,
        team2LogoPath,
        scoreFontPath,
        nameFontPath,
      }

      // 6. Show save dialog
      const projectDir = await window.api.getProjectDir(project.id)
      const defaultPath = `${projectDir}/${project.name}_broadcast.mp4`
      const outputPath = await window.api.showSaveHighlightsDialog(defaultPath)
      if (!outputPath) {
        return
      }

      // 7. Start render via App-level background job
      const clipsPath = `${projectDir}/clips.json`
      await onStartExport(project.id, project.name, {
        videoPath: project.videoPath,
        clipsPath,
        outputPath,
        config,
      })
      setExportError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setExportError(msg)
      alert(`Export failed: ${msg}`)
    }
  }, [
    clips,
    project,
    matchSetup,
    matchFlow,
    showOverlay,
    showStatScreen,
    templateId,
    variant,
    customOverlay,
    customIncludeNames,
    textConfig,
    statDuration,
    statBackground,
    resolution,
    fps,
    fontFamily,
  ])

  const handleCancelExport = useCallback(async () => {
    if (!confirm('Are you sure you want to cancel the export?')) return
    await window.api.cancelExport()
    setExportError('Export cancelled')
  }, [])

  const lastState = matchFlow.size > 0
    ? Array.from(matchFlow.entries()).pop()?.[1]
    : null
  const team1Score = lastState?.team1Score ?? 0
  const team2Score = lastState?.team2Score ?? 0
  const team1Name = matchSetup.team1.name
  const team2Name = matchSetup.team2.name

  const isPreset = templateId !== 'custom'

  const statCaptureEl = (
    <div
      ref={statCaptureRef}
      className="fixed top-0 left-0 flex items-center justify-center p-8"
      style={{
        width: resolution === '4k' ? 3840 : resolution === '1440p' ? 2560 : resolution === '720p' ? 1280 : 1920,
        height: resolution === '4k' ? 2160 : resolution === '1440p' ? 1440 : resolution === '720p' ? 720 : 1080,
        zIndex: -9999,
        pointerEvents: 'none' as const,
        backgroundColor: statBackground === 'black' ? '#000000' : 'rgba(0,0,0,0.5)',
        backdropFilter: statBackground === 'blur' ? 'blur(12px)' : undefined,
      }}
    >
      <div className="w-full max-w-[1680px] px-16">
        <StatOverlay stats={stats} matchSetup={matchSetup} showTeamTotals size="large" />
      </div>
    </div>
  )

  return (
    <div className="h-full flex flex-col bg-rc-darker text-gray-100 overflow-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />
      {/* Stat screen capture: only in portal during export so it renders fully; never visible over preview */}
      {isCapturingStatScreen && typeof document !== 'undefined' && createPortal(statCaptureEl, document.body)}

      <div className="flex-1 flex min-h-0">
        {/* Left: Live Preview (16:9) - overlay scales with this container */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 min-w-0">
          <div
            ref={previewContainerRef}
            className="relative w-full max-w-4xl rounded-lg overflow-hidden border border-gray-700 bg-black"
            style={{ aspectRatio: '16/9' }}
          >
            {/* Layer 1: Video */}
            <video
              ref={videoRef}
              src={project.videoPath ? toVideoUrl(project.videoPath) : undefined}
              className="absolute inset-0 w-full h-full object-contain bg-black cursor-pointer"
              muted
              loop
              playsInline
              autoPlay
              onError={(e) => console.error('Video load error:', e)}
              onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
            />
            {!project.videoPath && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <span className="text-gray-600 text-sm">No video loaded</span>
              </div>
            )}

            {/* Preview mode toggle */}
            <div className="absolute top-2 right-2 z-20 flex gap-1 no-drag">
              <button
                onClick={() => setPreviewMode('live')}
                className={`px-2 py-1 text-xs rounded ${previewMode === 'live' ? 'bg-rc-accent text-white' : 'bg-black/60 text-gray-400 hover:text-white'}`}
              >
                Live
              </button>
              <button
                onClick={() => {
                  setPreviewMode('stat')
                  videoRef.current?.pause()
                }}
                className={`px-2 py-1 text-xs rounded ${previewMode === 'stat' ? 'bg-rc-accent text-white' : 'bg-black/60 text-gray-400 hover:text-white'}`}
              >
                Stat Screen
              </button>
            </div>

            {/* Layer 2: Overlay (when showOverlay and live mode) */}
            {showOverlay && previewMode === 'live' && (
            <div className="absolute inset-0 pointer-events-none">
              {templateId === 'custom' && customOverlayUrl ? (
                <img
                  src={customOverlayUrl}
                  alt="Custom overlay"
                  className="w-full h-full object-cover"
                />
              ) : isPreset ? (
                <img
                  src={OVERLAY_PATHS[variant]}
                  alt={`${variant} overlay`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : null}
            </div>
            )}

            {/* Layer 3: Logos (minimal always; custom when includeLogos) - only when overlay shown and live */}
            {showOverlay && previewMode === 'live' && (team1LogoUrl || team2LogoUrl) && ((templateId === 'minimal') || (templateId === 'custom' && customIncludeLogos)) && (
              <div className="absolute inset-0 pointer-events-none">
                {team1LogoUrl && (
                  <img
                    src={team1LogoUrl}
                    alt="Team 1"
                    style={{
                      position: 'absolute',
                      left: `${(logoConfig.logo1.x / 1920) * 100}%`,
                      top: `${(logoConfig.logo1.y / 1080) * 100}%`,
                      width: `${(logoConfig.logo1.width / 1920) * 100}%`,
                      height: `${(logoConfig.logo1.height / 1080) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      objectFit: 'contain',
                    }}
                  />
                )}
                {team2LogoUrl && (
                  <img
                    src={team2LogoUrl}
                    alt="Team 2"
                    style={{
                      position: 'absolute',
                      left: `${(logoConfig.logo2.x / 1920) * 100}%`,
                      top: `${(logoConfig.logo2.y / 1080) * 100}%`,
                      width: `${(logoConfig.logo2.width / 1920) * 100}%`,
                      height: `${(logoConfig.logo2.height / 1080) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      objectFit: 'contain',
                    }}
                  />
                )}
              </div>
            )}

            {/* Layer 4: Dynamic text - scaled to preview container (viewing window), not app window */}
            {showOverlay && previewMode === 'live' && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ fontSize: Math.round(previewScale * textConfig.fontSize), fontFamily: `'${fontFamily}', sans-serif` }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: `${(textConfig.score1.x / 1920) * 100}%`,
                  top: `${(textConfig.score1.y / 1080) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  color: textConfig.score1.color,
                  fontWeight: 700,
                }}
              >
                {team1Score}
              </span>
              <span
                style={{
                  position: 'absolute',
                  left: `${(textConfig.score2.x / 1920) * 100}%`,
                  top: `${(textConfig.score2.y / 1080) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  color: textConfig.score2.color,
                  fontWeight: 700,
                }}
              >
                {team2Score}
              </span>
              {((templateId === 'names') || (templateId === 'custom' && customIncludeNames)) && (
                <>
                  <span
                    style={{
                      position: 'absolute',
                      left: `${(textConfig.name1.x / 1920) * 100}%`,
                      top: `${(textConfig.name1.y / 1080) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      color: textConfig.name1.color,
                      fontWeight: 600,
                      fontSize: Math.round(previewScale * textConfig.name1.fontSize),
                    }}
                  >
                    {team1Name}
                  </span>
                  <span
                    style={{
                      position: 'absolute',
                      left: `${(textConfig.name2.x / 1920) * 100}%`,
                      top: `${(textConfig.name2.y / 1080) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      color: textConfig.name2.color,
                      fontWeight: 600,
                      fontSize: Math.round(previewScale * textConfig.name2.fontSize),
                    }}
                  >
                    {team2Name}
                  </span>
                </>
              )}
            </div>
            )}

            {/* Layer 5: Stat screen overlay (when previewMode is stat and showStatScreen) */}
            {previewMode === 'stat' && showStatScreen && (
              <div
                className={`absolute inset-0 flex items-center justify-center p-4 ${
                  statBackground === 'blur' ? 'backdrop-blur-md bg-black/30' : 'bg-black/95'
                }`}
              >
                <div className="w-full max-w-4xl">
                  <StatOverlay stats={stats} matchSetup={matchSetup} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Sidebar with tabs */}
        <div className="w-80 flex-shrink-0 border-l border-gray-800 bg-rc-dark flex flex-col">
          <div className="flex border-b border-gray-700">
            {(['overlay', 'stat', 'export'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-2 text-sm font-medium capitalize ${
                  activeTab === tab
                    ? 'bg-rc-surface text-white border-b-2 border-rc-accent'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab === 'overlay' ? 'Overlay Design' : tab === 'stat' ? 'Stat Screen' : 'Export'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === 'overlay' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Template</label>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value as TemplateId)}
                    className="w-full px-3 py-2 bg-rc-surface border border-gray-600 rounded-md text-sm text-white"
                  >
                    <option value="minimal">Logo + Score</option>
                    <option value="names">Name + Score</option>
                    <option value="custom">Custom Upload</option>
                  </select>
                </div>

                {isPreset && (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Variant</label>
                    <select
                      value={variant}
                      onChange={(e) => setVariant(e.target.value as Variant)}
                      className="w-full px-3 py-2 bg-rc-surface border border-gray-600 rounded-md text-sm text-white"
                    >
                      <option value="top-middle">Top Middle</option>
                      <option value="top-corners">Top Corners</option>
                      <option value="stacked">Stacked</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Font</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full px-3 py-2 bg-rc-surface border border-gray-600 rounded-md text-sm text-white"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.label} value={f.label}>{f.label}</option>
                    ))}
                  </select>
                </div>

                {templateId === 'names' && (
                  <div className="space-y-3 border-t border-gray-700 pt-3">
                    <p className="text-xs font-medium text-gray-400">Name Customization</p>
                    {(['name1', 'name2'] as const).map((key) => (
                      <div key={key} className="space-y-1">
                        <label className="text-xs text-gray-500 capitalize">
                          {key === 'name1' ? 'Team 1 Name' : 'Team 2 Name'}
                        </label>
                        <div className="flex gap-2 items-center">
                          <span className="text-[10px] text-gray-500 w-6 text-right">{textConfig[key].x}</span>
                          <input
                            type="range"
                            min={0}
                            max={1920}
                            value={textConfig[key].x}
                            onChange={(e) =>
                              updateTextConfigPoint(key, 'x', Number(e.target.value))
                            }
                            className="flex-1"
                          />
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className="text-[10px] text-gray-500 w-6 text-right">{textConfig[key].y}</span>
                          <input
                            type="range"
                            min={0}
                            max={1080}
                            value={textConfig[key].y}
                            onChange={(e) =>
                              updateTextConfigPoint(key, 'y', Number(e.target.value))
                            }
                            className="flex-1"
                          />
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className="text-[10px] text-gray-500">Size</span>
                          <input
                            type="range"
                            min={24}
                            max={120}
                            value={textConfig[key].fontSize}
                            onChange={(e) =>
                              updateNameFontSize(key, Number(e.target.value))
                            }
                            className="flex-1"
                          />
                          <span className="text-[10px] text-gray-500">{textConfig[key].fontSize}px</span>
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className="text-[10px] text-gray-500">Color</span>
                          <input
                            type="color"
                            value={textConfig[key].color}
                            onChange={(e) => updateTextConfigColor(key, e.target.value)}
                            className="h-7 w-10 rounded cursor-pointer flex-shrink-0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {templateId === 'custom' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Custom Overlay
                      </label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png"
                        onChange={handleCustomOverlayChange}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-3 py-2 bg-rc-surface border border-gray-600 rounded-md text-sm text-gray-300 hover:bg-rc-surface-light transition-colors"
                      >
                        Upload Transparent PNG (1920×1080)
                      </button>
                      {customOverlay && (
                        <p className="mt-1 text-xs text-gray-500 truncate">{customOverlay.name}</p>
                      )}
                    </div>

                    <div className="space-y-2 border-t border-gray-700 pt-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customIncludeLogos}
                          onChange={(e) => setCustomIncludeLogos(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-300">Include logos</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customIncludeNames}
                          onChange={(e) => setCustomIncludeNames(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-300">Include names</span>
                      </label>
                    </div>

                    <div className="space-y-3 border-t border-gray-700 pt-3">
                      <p className="text-xs font-medium text-gray-400">Adjustments</p>
                      {(['score1', 'score2', 'name1', 'name2'] as const).map((key) => (
                        <div key={key} className="space-y-1">
                          <label className="text-xs text-gray-500 capitalize">
                            {key.replace(/(\d)/, ' $1')}
                          </label>
                          <div className="flex gap-2 items-center">
                            <span className="text-[10px] text-gray-500 w-6 text-right">{textConfig[key].x}</span>
                            <input
                              type="range"
                              min={0}
                              max={1920}
                              value={textConfig[key].x}
                              onChange={(e) =>
                                updateTextConfigPoint(key, 'x', Number(e.target.value))
                              }
                              className="flex-1"
                            />
                          </div>
                          <div className="flex gap-2 items-center">
                            <span className="text-[10px] text-gray-500 w-6 text-right">{textConfig[key].y}</span>
                            <input
                              type="range"
                              min={0}
                              max={1080}
                              value={textConfig[key].y}
                              onChange={(e) =>
                                updateTextConfigPoint(key, 'y', Number(e.target.value))
                              }
                              className="flex-1"
                            />
                          </div>
                          {(key === 'name1' || key === 'name2') && (
                            <>
                              <div className="flex gap-2 items-center">
                                <span className="text-[10px] text-gray-500">Size</span>
                                <input
                                  type="range"
                                  min={24}
                                  max={120}
                                  value={textConfig[key].fontSize}
                                  onChange={(e) =>
                                    updateNameFontSize(key, Number(e.target.value))
                                  }
                                  className="flex-1"
                                />
                                <span className="text-xs text-gray-500">{textConfig[key].fontSize}px</span>
                              </div>
                              <div className="flex gap-2 items-center">
                                <span className="text-[10px] text-gray-500">Color</span>
                                <input
                                  type="color"
                                  value={textConfig[key].color}
                                  onChange={(e) => updateTextConfigColor(key, e.target.value)}
                                  className="h-7 w-10 rounded cursor-pointer flex-shrink-0"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      <div>
                        <label className="text-xs text-gray-500">Score Font Size</label>
                        <input
                          type="range"
                          min={24}
                          max={120}
                          value={textConfig.fontSize}
                          onChange={(e) =>
                            updateTextConfig('fontSize', Number(e.target.value))
                          }
                          className="w-full"
                        />
                        <span className="text-xs text-gray-500">{textConfig.fontSize}px</span>
                      </div>
                    </div>
                  </>
                )}

                {(templateId === 'minimal' || templateId === 'custom') && (
                <div className="border-t border-gray-700 pt-3">
                  <p className="text-xs font-medium text-gray-400 mb-2">Logos</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Team 1</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleTeam1LogoChange}
                        className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-rc-surface file:text-gray-300"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Team 2</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleTeam2LogoChange}
                        className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-rc-surface file:text-gray-300"
                      />
                    </div>
                  </div>

                  {(team1LogoUrl || team2LogoUrl) && templateId === 'custom' && (
                    <div className="mt-3 space-y-3 border-t border-gray-700 pt-3">
                      <p className="text-xs font-medium text-gray-400">Logo Position & Size</p>
                      {(['logo1', 'logo2'] as const).map((key) => (
                        <div key={key} className="space-y-1">
                          <label className="text-xs text-gray-500 capitalize">
                            {key === 'logo1' ? 'Team 1 Logo' : 'Team 2 Logo'}
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-gray-500">X</span>
                              <input
                                type="range"
                                min={0}
                                max={1920}
                                value={logoConfig[key].x}
                                onChange={(e) =>
                                  updateLogoConfig(key, 'x', Number(e.target.value))
                                }
                                className="w-full"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-500">Y</span>
                              <input
                                type="range"
                                min={0}
                                max={1080}
                                value={logoConfig[key].y}
                                onChange={(e) =>
                                  updateLogoConfig(key, 'y', Number(e.target.value))
                                }
                                className="w-full"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-500">W</span>
                              <input
                                type="range"
                                min={20}
                                max={300}
                                value={logoConfig[key].width}
                                onChange={(e) =>
                                  updateLogoConfig(key, 'width', Number(e.target.value))
                                }
                                className="w-full"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-500">H</span>
                              <input
                                type="range"
                                min={20}
                                max={300}
                                value={logoConfig[key].height}
                                onChange={(e) =>
                                  updateLogoConfig(key, 'height', Number(e.target.value))
                                }
                                className="w-full"
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-500">
                            {logoConfig[key].x}, {logoConfig[key].y} · {logoConfig[key].width}×
                            {logoConfig[key].height}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </>
            )}

            {activeTab === 'stat' && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-300">Show Stat Screen</label>
                  <input
                    type="checkbox"
                    checked={showStatScreen}
                    onChange={(e) => setShowStatScreen(e.target.checked)}
                    className="rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Duration ({statDuration}s)
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={15}
                    value={statDuration}
                    onChange={(e) => setStatDuration(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Background</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStatBackground('black')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm ${
                        statBackground === 'black'
                          ? 'bg-rc-accent text-white'
                          : 'bg-rc-surface text-gray-400'
                      }`}
                    >
                      Black
                    </button>
                    <button
                      onClick={() => setStatBackground('blur')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm ${
                        statBackground === 'blur'
                          ? 'bg-rc-accent text-white'
                          : 'bg-rc-surface text-gray-400'
                      }`}
                    >
                      Blur
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-2">Preview</p>
                  <div className="overflow-auto max-h-48 rounded border border-gray-700">
                    <StatOverlay stats={stats} matchSetup={matchSetup} compact showTeamTotals={false} />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'export' && (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOverlay}
                      onChange={(e) => setShowOverlay(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-300">Include overlay</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showStatScreen}
                      onChange={(e) => setShowStatScreen(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-300">Include stat screen</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Resolution</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full px-3 py-2 bg-rc-surface border border-gray-600 rounded-md text-sm text-white"
                  >
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                    <option value="1440p">1440p</option>
                    <option value="4k">4K</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Frame Rate</label>
                  <select
                    value={fps}
                    onChange={(e) => setFps(e.target.value)}
                    className="w-full px-3 py-2 bg-rc-surface border border-gray-600 rounded-md text-sm text-white"
                  >
                    <option value="source">Match Source</option>
                    <option value="30">30 fps</option>
                    <option value="60">60 fps</option>
                    <option value="120">120 fps</option>
                  </select>
                </div>
                {/* Export time disclaimers */}
                {(() => {
                  const hints: string[] = []
                  if (!showOverlay && !showStatScreen && resolution === '1080p')
                    hints.push('Fast export — no re-encoding needed')
                  if (resolution === '1440p')
                    hints.push('Export may take longer at this resolution')
                  if (resolution === '4k')
                    hints.push('4K exports can take 20–30+ minutes')
                  if (fps === '120')
                    hints.push('120 fps encoding takes longer than lower frame rates')
                  return hints.length > 0 ? (
                    <div className="space-y-1">
                      {hints.map((h, i) => (
                        <p key={i} className="text-xs text-yellow-400/80">{h}</p>
                      ))}
                    </div>
                  ) : null
                })()}
                {exporting ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 text-center">
                      Exporting in background… You can navigate away.
                    </p>
                    <button
                      onClick={handleCancelExport}
                      className="w-full px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Cancel Export
                    </button>
                  </div>
                ) : (
                  <button
                    className="w-full px-4 py-3 bg-rc-accent hover:bg-rc-accent-hover text-white font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleExportStudio}
                  >
                    Export Video
                  </button>
                )}
                {exportError && (
                  <p className="text-xs text-red-400 mt-2">{exportError}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 px-6 py-2 border-t border-gray-800 flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-sm rounded-md bg-rc-surface hover:bg-rc-surface-light transition-colors"
        >
          ← Back to Editor
        </button>
      </div>
    </div>
  )
}
