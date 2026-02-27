import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project, Clip } from '../App'
import { useMatchContext } from '../context/MatchContext'
import { toVideoUrl } from '../utils/video-url'
import { UpgradeModal } from './UpgradeModal'
import { ProjectSettingsModal } from './ProjectSettingsModal'

interface EditorProps {
  project: Project
  clips: Clip[]
  onClipsChange: (clips: Clip[]) => void
  onOpenExportStudio?: () => void
  onProjectUpdate?: (name: string) => void
}

// ── Stat button definitions ───────────────────────────────────────
const STAT_BUTTONS = [
  { key: 1, label: 'ACE',              color: 'bg-green-100  hover:bg-green-200  text-green-800  border border-green-200',  statType: 'ace'           as const },
  { key: 2, label: 'DOUBLE FAULT',     color: 'bg-red-100    hover:bg-red-200    text-red-800    border border-red-200',    statType: 'double_fault'  as const },
  { key: 3, label: 'SERVICE BREAK',    color: 'bg-green-100  hover:bg-green-200  text-green-800  border border-green-200',  statType: 'service_break' as const },
  { key: 4, label: 'SIDEOUT',          color: 'bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-200', statType: 'sideout'       as const },
  { key: 5, label: 'DEFENSIVE BREAK',  color: 'bg-blue-100   hover:bg-blue-200   text-blue-800   border border-blue-200',   statType: 'def_break'     as const },
  { key: 6, label: 'DEFENSIVE HOLD',   color: 'bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200', statType: 'def_hold'      as const },
  { key: 7, label: 'ERROR',            color: 'bg-red-100    hover:bg-red-200    text-red-800    border border-red-200',    statType: 'error'         as const },
  { key: 8, label: 'NONE',             color: 'bg-cut-warm/20 hover:bg-cut-warm/40 text-cut-mid  border border-cut-warm/30', statType: 'none'         as const },
]

// ── Stat descriptions for info panel ─────────────────────────────
const STAT_DESCRIPTIONS = [
  { label: 'ACE',             desc: 'Unreturnable serve (no reasonable chance to set)' },
  { label: 'DOUBLE FAULT',    desc: 'Two consecutive service errors' },
  { label: 'SERVICE BREAK',   desc: 'Server wins point due to service pressure' },
  { label: 'SIDEOUT',         desc: 'Clean return by recieving team, no rally' },
  { label: 'DEFENSIVE BREAK', desc: 'Point won by the serving team after defensive touches' },
  { label: 'DEFENSIVE HOLD',  desc: 'Point won by the recieving team after defensive touches' },
  { label: 'ERROR',           desc: 'Unforced error by a specific player' },
]

// ── Tag colours for filmstrip clips ──────────────────────────────
const TAG_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Rally: { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700' },
  Serve: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  Noise: { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-600'   },
}

function getStatLabel(statType?: Clip['statType']): string {
  if (!statType) return ''
  return STAT_BUTTONS.find(s => s.statType === statType)?.label || ''
}

// ── Small reusable nudge button ────────────────────────────────────
function NudgeBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-w-[34px] px-1.5 py-2 text-xs bg-cut-warm/20 hover:bg-cut-warm/50 text-cut-deep rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
    >
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────
export function Editor({ project, clips, onClipsChange, onOpenExportStudio, onProjectUpdate }: EditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [selectedClipIndex, setSelectedClipIndex]   = useState<number | null>(null)
  const [videoDuration, setVideoDuration]             = useState(0)
  const [isPlaying, setIsPlaying]                     = useState(false)
  const [playAllMode, setPlayAllMode]                 = useState(false)
  const [playAllIndex, setPlayAllIndex]               = useState(0)
  const [saving, setSaving]                           = useState(false)
  const [exporting, setExporting]                     = useState(false)
  const [showAddClipModal, setShowAddClipModal]       = useState(false)
  const [addClipStart, setAddClipStart]               = useState('')
  const [addClipEnd, setAddClipEnd]                   = useState('')
  const [showPlayerOverlay, setShowPlayerOverlay]     = useState(false)
  const [playerOverlayStat, setPlayerOverlayStat]     = useState<Clip['statType'] | null>(null)
  const [selectedPlayers, setSelectedPlayers]         = useState<string[]>([])
  const [showKeybindsModal, setShowKeybindsModal]     = useState(false)
  const [showStatsInfo,     setShowStatsInfo]         = useState(false)
  const [showClippingInfo,  setShowClippingInfo]      = useState(false)
  const [showUpgradeModal,  setShowUpgradeModal]      = useState(false)
  const [exportUsed,        setExportUsed]            = useState(0)
  const [exportLimit,       setExportLimit]           = useState(3)
  const [exportDenyReason,  setExportDenyReason]      = useState<string | undefined>()
  const [showSettingsModal, setShowSettingsModal]     = useState(false)

  // Collapsible right-panel sections
  const [statsCollapsed,    setStatsCollapsed]    = useState(false)
  const [clippingCollapsed, setClippingCollapsed] = useState(false)

  const { getClipState, getLastState, matchSetup, setMatchSetup } = useMatchContext()

  // Ensure clips have IDs and migrate keep→status
  useEffect(() => {
    const needsUpdate = clips.some((clip, idx) => {
      const expectedId = idx + 1
      const hasKeep   = 'keep' in clip && clip.keep !== undefined
      return !clip.id || clip.id !== expectedId || (!clip.status && hasKeep)
    })
    if (needsUpdate) {
      const updated = clips.map((clip, idx) => {
        const id = idx + 1
        let status: Clip['status'] = clip.status || 'pending'
        if (!clip.status && 'keep' in clip) status = clip.keep === false ? 'trash' : 'pending'
        return { ...clip, id, status }
      })
      onClipsChange(updated)
    }
  }, [clips, onClipsChange])

  const selectedClip = selectedClipIndex !== null ? clips[selectedClipIndex] : null
  const keptClips    = clips.filter(c => c.status ? c.status !== 'trash' : c.keep !== false)

  const displayState = selectedClip && selectedClipIndex !== null
    ? getClipState(String(selectedClip.id ?? selectedClipIndex + 1)) ?? getLastState()
    : getLastState()

  // ── Video Event Handlers ────────────────────────────────────────

  const handleVideoLoaded = () => {
    if (videoRef.current) setVideoDuration(videoRef.current.duration)
  }

  const handlePlayPause = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true) }
    else                          { videoRef.current.pause(); setIsPlaying(false) }
  }

  // ── Clip Selection ──────────────────────────────────────────────

  const handleSelectClip = (index: number) => {
    setSelectedClipIndex(index)
    setPlayAllMode(false)
    const clip = clips[index]
    if (videoRef.current) {
      videoRef.current.currentTime = clip.start
      videoRef.current.play().catch(e => console.log('Play failed:', e))
      setIsPlaying(true)
    }
  }

  // ── Clip Looping ────────────────────────────────────────────────

  useEffect(() => {
    if (!videoRef.current || selectedClipIndex === null || playAllMode) return
    const handleTimeUpdate = () => {
      if (selectedClipIndex === null || selectedClipIndex >= clips.length) return
      const cur = clips[selectedClipIndex]
      if (videoRef.current && videoRef.current.currentTime >= cur.end) {
        videoRef.current.currentTime = cur.start
        videoRef.current.play().catch(() => {})
      }
    }
    videoRef.current.addEventListener('timeupdate', handleTimeUpdate)
    return () => videoRef.current?.removeEventListener('timeupdate', handleTimeUpdate)
  }, [selectedClipIndex, clips, playAllMode])

  // ── Trash / Restore ─────────────────────────────────────────────

  const handleTrashClip = (index: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const updated = [...clips]
    updated[index] = { ...updated[index], status: 'trash', keep: false }
    onClipsChange(updated)
    if (selectedClipIndex === index) {
      if (index + 1 < clips.length) handleSelectClip(index + 1)
      else if (index > 0)           handleSelectClip(index - 1)
      else                          setSelectedClipIndex(null)
    }
  }

  const handleRestoreClip = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = [...clips]
    updated[index] = { ...updated[index], status: 'pending', keep: true }
    onClipsChange(updated)
  }

  // ── Add Clip ────────────────────────────────────────────────────

  const openAddClipModal = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime
      setAddClipStart(t.toFixed(1))
      setAddClipEnd(Math.min(videoDuration, t + 10).toFixed(1))
    } else {
      setAddClipStart('0'); setAddClipEnd('10')
    }
    setShowAddClipModal(true)
  }

  const handleAddClip = () => {
    const start = parseFloat(addClipStart)
    const end   = parseFloat(addClipEnd)
    if (Number.isNaN(start) || Number.isNaN(end))              { alert('Please enter valid numbers.'); return }
    if (start < 0 || end > videoDuration)                      { alert(`Start must be ≥ 0 and end must be ≤ ${videoDuration.toFixed(1)}s.`); return }
    if (start >= end)                                          { alert('Start time must be before end time.'); return }
    const duration = Number((end - start).toFixed(3))
    const newId    = clips.length > 0 ? Math.max(...clips.map(c => c.id || 0)) + 1 : 1
    const newClip: Clip = { id: newId, start: Number(start.toFixed(3)), end: Number(end.toFixed(3)), duration, tag: 'Rally', confidence: 'Medium', peak_energy: 0, status: 'pending' }
    const insertIndex = clips.findIndex(c => c.start > newClip.start)
    const idx = insertIndex === -1 ? clips.length : insertIndex
    const reindexed = [...clips.slice(0, idx), newClip, ...clips.slice(idx)].map((c, i) => ({ ...c, id: i + 1 }))
    onClipsChange(reindexed)
    setShowAddClipModal(false)
    setSelectedClipIndex(idx)
    if (videoRef.current) { videoRef.current.currentTime = newClip.start; videoRef.current.play().catch(() => {}); setIsPlaying(true) }
  }

  // ── Nudge Handlers ──────────────────────────────────────────────

  const handleStartChange = (newStart: number) => {
    if (selectedClipIndex === null) return
    const updated = [...clips]
    updated[selectedClipIndex] = { ...updated[selectedClipIndex], start: Number(newStart.toFixed(3)), duration: Number((updated[selectedClipIndex].end - newStart).toFixed(3)) }
    onClipsChange(updated)
    if (videoRef.current) { videoRef.current.currentTime = newStart; videoRef.current.play().catch(() => {}) }
  }

  const handleEndChange = (newEnd: number) => {
    if (selectedClipIndex === null) return
    const updated = [...clips]
    const clip = updated[selectedClipIndex]
    updated[selectedClipIndex] = { ...clip, end: Number(newEnd.toFixed(3)), duration: Number((newEnd - clip.start).toFixed(3)) }
    onClipsChange(updated)
    if (videoRef.current) {
      const previewStart = Math.max(clip.start, newEnd - 1.0)
      videoRef.current.currentTime = previewStart
      videoRef.current.play().catch(() => {})
    }
  }

  // ── Set Start / End at current playhead ─────────────────────────

  const handleSetStart = () => {
    if (selectedClipIndex === null || !videoRef.current) return
    const t = videoRef.current.currentTime
    if (t >= clips[selectedClipIndex].end) { alert('Start time must be before end time'); return }
    handleStartChange(t)
  }

  const handleSetEnd = () => {
    if (selectedClipIndex === null || !videoRef.current) return
    const t = videoRef.current.currentTime
    if (t <= clips[selectedClipIndex].start) { alert('End time must be after start time'); return }
    handleEndChange(t)
  }

  // ── Stat Handlers ───────────────────────────────────────────────

  const handleStatButton = (statType: Clip['statType']) => {
    if (selectedClipIndex === null || !selectedClip) return
    if (statType === 'def_break' || statType === 'def_hold' || statType === 'error') {
      setPlayerOverlayStat(statType); setSelectedPlayers([]); setShowPlayerOverlay(true); return
    }
    const updated = [...clips]
    updated[selectedClipIndex] = { ...updated[selectedClipIndex], statType, status: 'done' }
    onClipsChange(updated)
  }

  const handlePlayerOverlayConfirm = () => {
    if (selectedClipIndex === null || !playerOverlayStat) return
    if (playerOverlayStat === 'error' && selectedPlayers.length !== 1) { alert('Please select exactly one player for ERROR.'); return }
    if ((playerOverlayStat === 'def_break' || playerOverlayStat === 'def_hold') && selectedPlayers.length === 0) { alert('Please add at least one touch.'); return }
    if (selectedPlayers.length === 0) { alert('Please select at least one player.'); return }
    const updated = [...clips]
    updated[selectedClipIndex] = { ...updated[selectedClipIndex], statType: playerOverlayStat, involvedPlayers: [...selectedPlayers], status: 'done' }
    onClipsChange(updated)
    setShowPlayerOverlay(false); setPlayerOverlayStat(null); setSelectedPlayers([])
  }

  const handlePlayerOverlayCancel = () => { setShowPlayerOverlay(false); setPlayerOverlayStat(null); setSelectedPlayers([]) }

  const togglePlayer = (playerId: string) => {
    if (playerOverlayStat === 'error')
      setSelectedPlayers([playerId])
    else if (playerOverlayStat === 'def_break' || playerOverlayStat === 'def_hold')
      setSelectedPlayers(prev => [...prev, playerId])
    else
      setSelectedPlayers(prev => prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId])
  }

  const removeLastTouch = () => setSelectedPlayers(prev => prev.length > 0 ? prev.slice(0, -1) : prev)

  // ── Keyboard Shortcuts ──────────────────────────────────────────

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept keys when user is typing in an input field
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    const key   = e.key.toLowerCase()
    const shift = e.shiftKey

    if (key >= '1' && key <= '8' && selectedClipIndex !== null) {
      e.preventDefault()
      const stat = STAT_BUTTONS.find(s => s.key === parseInt(key))
      if (stat) handleStatButton(stat.statType)
      return
    }
    if (key === 'arrowleft' || key === 'arrowright') {
      if (clips.length === 0) return
      e.preventDefault()
      const nextIndex = key === 'arrowleft'
        ? selectedClipIndex === null ? clips.length - 1 : (selectedClipIndex - 1 + clips.length) % clips.length
        : selectedClipIndex === null ? 0 : (selectedClipIndex + 1) % clips.length
      handleSelectClip(nextIndex); return
    }
    if (key === 'w' && selectedClipIndex !== null) { e.preventDefault(); handleSetStart(); return }
    if (key === 's' && selectedClipIndex !== null) { e.preventDefault(); handleSetEnd(); return }
    if ((key === 'delete' || key === 'backspace') && selectedClipIndex !== null) { e.preventDefault(); handleTrashClip(selectedClipIndex); return }
    if (selectedClipIndex === null || !selectedClip) return

    const dL = 1.0, dS = 0.1
    switch (key) {
      case 'q': e.preventDefault(); handleStartChange(Math.max(0, selectedClip.start - (shift ? dS : dL))); break
      case 'e': e.preventDefault(); handleStartChange(Math.min(videoDuration, selectedClip.start + (shift ? dS : dL))); break
      case 'a': e.preventDefault(); handleEndChange(Math.max(0, selectedClip.end - (shift ? dS : dL))); break
      case 'd': e.preventDefault(); handleEndChange(Math.min(videoDuration, selectedClip.end + (shift ? dS : dL))); break
      case ' ': e.preventDefault(); handlePlayPause(); break
    }
  }, [selectedClipIndex, selectedClip, videoDuration, clips, handleSelectClip, handleSetStart, handleSetEnd, handleStartChange, handleEndChange, handlePlayPause])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ── Play All Mode ───────────────────────────────────────────────

  const handlePlayAll = () => {
    if (keptClips.length === 0) { alert('No clips to play'); return }
    setPlayAllMode(true); setPlayAllIndex(0); setSelectedClipIndex(null)
    if (videoRef.current) { videoRef.current.currentTime = keptClips[0].start; videoRef.current.play(); setIsPlaying(true) }
  }

  const handleStopPlayAll = () => {
    setPlayAllMode(false)
    if (videoRef.current) { videoRef.current.pause(); setIsPlaying(false) }
  }

  useEffect(() => {
    if (!playAllMode || !videoRef.current) return
    const handleTimeUpdate = () => {
      if (playAllIndex >= keptClips.length) return
      const cur = keptClips[playAllIndex]
      if (videoRef.current!.currentTime >= cur.end) {
        if (playAllIndex < keptClips.length - 1) {
          setPlayAllIndex(playAllIndex + 1)
          videoRef.current!.currentTime = keptClips[playAllIndex + 1].start
        } else {
          setPlayAllIndex(0)
          videoRef.current!.currentTime = keptClips[0].start
        }
      }
    }
    videoRef.current.addEventListener('timeupdate', handleTimeUpdate)
    return () => videoRef.current?.removeEventListener('timeupdate', handleTimeUpdate)
  }, [playAllMode, playAllIndex, keptClips])

  // ── Save Changes ────────────────────────────────────────────────

  const handleSaveChanges = async () => {
    setSaving(true)
    try {
      await window.api.saveEditedClips(project.id, { video: project.videoPath, video_path: project.videoPath, clips })
      alert('Changes saved successfully!')
    } catch { alert('Failed to save changes') }
    finally  { setSaving(false) }
  }

  // ── Settings Save ───────────────────────────────────────────────

  const handleSettingsSave = async (newName: string, updatedSetup: typeof matchSetup) => {
    if (newName !== project.name) {
      await window.api.updateProject(project.id, { name: newName })
      onProjectUpdate?.(newName)
    }
    if (updatedSetup) {
      await window.api.writeMatchSetup(project.id, updatedSetup)
      setMatchSetup(updatedSetup)
    }
    setShowSettingsModal(false)
  }

  // ── Export Gate ─────────────────────────────────────────────────

  const checkCanExport = async (): Promise<boolean> => {
    const result = await window.api.auth.canExport()
    if (!result.allowed) {
      setExportUsed(result.used)
      setExportLimit(result.limit)
      setExportDenyReason(result.reason)
      setShowUpgradeModal(true)
      return false
    }
    return true
  }

  const handleOpenExportStudioGated = async () => {
    const ok = await checkCanExport()
    if (ok) onOpenExportStudio?.()
  }

  // ── Export (quick export, no studio) ───────────────────────────

  const handleExport = async () => {
    if (saving) return
    const canExport = await checkCanExport()
    if (!canExport) return

    setSaving(true)
    try {
      await window.api.saveEditedClips(project.id, { video: project.videoPath, video_path: project.videoPath, clips })
    } catch { alert('Failed to save changes before export'); setSaving(false); return }
    finally  { setSaving(false) }

    const projectDir  = await window.api.getProjectDir(project.id)
    const defaultPath = `${projectDir}/${project.name}_condensed.mp4`
    const outputPath  = await window.api.showSaveHighlightsDialog(defaultPath)
    if (!outputPath) return

    setExporting(true)
    try {
      const result = await window.api.renderHighlights({ projectId: project.id, videoPath: project.videoPath, clipsPath: `${projectDir}/clips.json`, outputPath })
      if (!result.success) throw new Error(result.message)
      window.api.onRenderComplete(async (data) => {
        if (data.projectId !== project.id) return
        await window.api.auth.recordExport()
        setExporting(false)
        alert(`Export complete!\n\nSaved to: ${data.outputPath}`)
        window.api.updateProject(project.id, { status: 'exported', finalVideo: data.outputPath })
      })
      window.api.onRenderError((data) => {
        if (data.projectId !== project.id) return
        setExporting(false)
        if (confirm(`Export failed: ${data.error}\n\nWould you like to retry?`)) handleExport()
      })
    } catch (err) { alert(`Failed to start export: ${err}`); setExporting(false) }
  }

  // ── Render ──────────────────────────────────────────────────────

  const serverName   = displayState ? (matchSetup?.team1.players.find(p => p.id === displayState.serverPlayerId)?.name   ?? matchSetup?.team2.players.find(p => p.id === displayState.serverPlayerId)?.name   ?? displayState.serverPlayerId)   : '—'
  const receiverName = displayState ? (matchSetup?.team1.players.find(p => p.id === displayState.receiverPlayerId)?.name ?? matchSetup?.team2.players.find(p => p.id === displayState.receiverPlayerId)?.name ?? displayState.receiverPlayerId) : '—'

  return (
    <div className="h-full flex flex-col min-h-0 bg-cut-base text-cut-deep">

      {/* ═══ Sub-action bar ════════════════════════════════════════ */}
      <div className="flex-shrink-0 h-12 bg-white border-b border-cut-warm/40 px-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Save */}
          <button
            onClick={handleSaveChanges}
            disabled={saving || exporting}
            className="h-8 px-4 text-sm font-medium bg-cut-warm/30 text-cut-deep hover:bg-cut-warm transition-colors rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>

          {/* Play All / Stop */}
          {!playAllMode ? (
            <button
              onClick={handlePlayAll}
              disabled={keptClips.length === 0}
              className="h-8 px-4 text-sm font-medium bg-cut-warm/30 text-cut-deep hover:bg-cut-warm transition-colors rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Play All
            </button>
          ) : (
            <button
              onClick={handleStopPlayAll}
              className="h-8 px-4 text-sm font-medium bg-rc-red/10 text-rc-red hover:bg-rc-red/20 transition-colors rounded-lg border border-rc-red/20"
            >
              ⏹ Stop
            </button>
          )}

          {/* Export Studio */}
          <button
            onClick={onOpenExportStudio ? handleOpenExportStudioGated : handleExport}
            disabled={saving || exporting || keptClips.length === 0}
            className="h-8 px-4 text-sm font-medium bg-cut-deep text-cut-base hover:bg-cut-deep/90 transition-colors rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="h-8 px-4 text-sm font-medium border border-cut-warm/40 text-cut-mid hover:bg-cut-base hover:text-cut-deep transition-colors rounded-lg"
          >
            Settings
          </button>

          {/* Keybinds */}
          <button
            onClick={() => setShowKeybindsModal(true)}
            className="h-8 px-4 text-sm font-medium border border-cut-warm/40 text-cut-mid hover:bg-cut-base hover:text-cut-deep transition-colors rounded-lg"
          >
            Keybinds
          </button>
        </div>
      </div>

      {/* ═══ Main content area ═════════════════════════════════════ */}
      <div className="flex-1 flex min-h-0">

        {/* ── Left: Video theater (~68%) ───────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">

          {/* Info bar above video */}
          <div className="flex-shrink-0 h-10 bg-white border-b border-cut-warm/30 px-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="font-bold text-cut-deep text-base">
                {displayState?.team1Score ?? 0} – {displayState?.team2Score ?? 0}
              </span>
              {matchSetup && displayState && (
                <>
                  <span className="text-cut-muted">·</span>
                  <span className="text-cut-mid">S: <span className="text-cut-deep font-medium">{serverName}</span></span>
                  <span className="text-cut-muted">·</span>
                  <span className="text-cut-mid">R: <span className="text-cut-deep font-medium">{receiverName}</span></span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4 text-cut-mid">
              {selectedClip && (
                <>
                  <span>Clip <span className="font-medium text-cut-deep">{selectedClip.id ?? (selectedClipIndex ?? 0) + 1}</span> / {clips.length}</span>
                  <span>Duration: <span className="font-medium text-cut-deep">{selectedClip.duration.toFixed(1)}s</span></span>
                </>
              )}
              {playAllMode && (
                <span className="px-2 py-0.5 bg-cut-deep text-cut-base text-xs rounded-full font-semibold">
                  Playing {playAllIndex + 1}/{keptClips.length}
                </span>
              )}
            </div>
          </div>

          {/* Video container */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            <div className="relative w-full h-full flex items-center justify-center bg-black rounded-xl border border-cut-warm/10 overflow-hidden min-h-[300px]">
              <video
                ref={videoRef}
                src={project.videoPath ? toVideoUrl(project.videoPath) : undefined}
                onLoadedMetadata={handleVideoLoaded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={(e) => console.error('Video load error:', e)}
                onClick={handlePlayPause}
                className="max-w-full max-h-full cursor-pointer"
              />
              {/* Play icon when paused */}
              {!isPlaying && (
                <button
                  onClick={handlePlayPause}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <span className="text-2xl ml-1 text-white">▶</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Stats + Clipping panels (~32%) ───────────── */}
        <div className="w-72 flex-shrink-0 border-l border-cut-warm/40 bg-white flex flex-col overflow-hidden relative">

          {/* ── Stats panel ──────────────────────────────── */}
          <div className="flex-shrink-0 border-b border-cut-warm/30">
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-cut-deep">Stats</span>
                <button
                  onClick={() => setShowStatsInfo(v => !v)}
                  className={`w-4 h-4 rounded-full border text-[10px] flex items-center justify-center transition-colors ${showStatsInfo ? 'border-cut-deep text-cut-deep bg-cut-warm/20' : 'border-cut-warm text-cut-muted hover:border-cut-mid hover:text-cut-mid'}`}
                >
                  i
                </button>
              </div>
              {/* Collapse toggle */}
              <button
                onClick={() => setStatsCollapsed(v => !v)}
                className="w-6 h-6 flex items-center justify-center text-cut-muted hover:text-cut-deep transition-colors rounded"
                title={statsCollapsed ? 'Expand' : 'Collapse'}
              >
                {statsCollapsed ? '▼' : '▲'}
              </button>
            </div>

            {showStatsInfo && (
              <div className="mx-3 mb-2 bg-cut-base rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-cut-deep uppercase tracking-wider">Stat Descriptions</p>
                {STAT_DESCRIPTIONS.map(({ label, desc }) => (
                  <div key={label}>
                    <span className="text-[10px] font-bold text-cut-deep uppercase tracking-wide">{label}</span>
                    <p className="text-[10px] text-cut-mid leading-snug mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            )}

            {!statsCollapsed && (
              <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
                {STAT_BUTTONS.map(stat => (
                  <button
                    key={stat.key}
                    onClick={() => handleStatButton(stat.statType)}
                    disabled={selectedClipIndex === null}
                    className={`
                      px-2 py-2.5 text-xs font-semibold rounded-lg transition-colors text-left
                      ${stat.color}
                      ${selectedClipIndex === null ? 'opacity-40 cursor-not-allowed' : ''}
                      ${showPlayerOverlay ? 'opacity-30' : ''}
                    `}
                    title={`Hotkey: ${stat.key}`}
                  >
                    <span className="opacity-50 mr-1">{stat.key}.</span>{stat.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Clipping panel ───────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto dark-scroll">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-cut-warm/30 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-cut-deep">Clipping</span>
                <button
                  onClick={() => setShowClippingInfo(v => !v)}
                  className={`w-4 h-4 rounded-full border text-[10px] flex items-center justify-center transition-colors ${showClippingInfo ? 'border-cut-deep text-cut-deep bg-cut-warm/20' : 'border-cut-warm text-cut-muted hover:border-cut-mid hover:text-cut-mid'}`}
                >
                  i
                </button>
              </div>
              {/* Collapse toggle */}
              <button
                onClick={() => setClippingCollapsed(v => !v)}
                className="w-6 h-6 flex items-center justify-center text-cut-muted hover:text-cut-deep transition-colors rounded"
                title={clippingCollapsed ? 'Expand' : 'Collapse'}
              >
                {clippingCollapsed ? '▼' : '▲'}
              </button>
            </div>

            {!clippingCollapsed && (
              <div className="px-4 py-4 space-y-5">
                {showClippingInfo && (
                  <div className="bg-cut-base rounded-xl p-3 space-y-2 -mt-1">
                    <p className="text-[10px] text-cut-mid leading-relaxed">These buttons change the start and end time of each clip.</p>
                    <div className="p-2 bg-white rounded-lg border border-cut-warm/30">
                      <p className="text-[10px] font-bold text-cut-deep uppercase tracking-wide mb-1">Tip</p>
                      <p className="text-[10px] text-cut-mid leading-snug">Check the keybinds, they make it very easy to operate and clip fast.</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-cut-warm/30">
                      <p className="text-[10px] font-bold text-cut-deep uppercase tracking-wide mb-1">Pro workflow</p>
                      <p className="text-[10px] text-cut-mid leading-snug">Watch the clip, click <span className="font-mono font-semibold text-cut-deep">W</span> (Start Here) for the start, then click <span className="font-mono font-semibold text-cut-deep">S</span> (End Here) right when it should end.</p>
                    </div>
                  </div>
                )}
                {selectedClip ? (
                  <>
                    {/* Start Time */}
                    <div>
                      <p className="text-xs text-cut-mid mb-2">
                        Start Time: <span className="font-mono font-semibold text-cut-deep">{formatTime(selectedClip.start)}</span>
                      </p>
                      <div className="flex items-center gap-1">
                        <NudgeBtn label="-1s"  onClick={() => handleStartChange(Math.max(0, selectedClip.start - 1.0))} disabled={!selectedClip} />
                        <NudgeBtn label="-.1s" onClick={() => handleStartChange(Math.max(0, selectedClip.start - 0.1))} disabled={!selectedClip} />
                        <button
                          onClick={handleSetStart}
                          title="Hotkey: W"
                          className="flex-1 py-2 text-xs font-semibold bg-cut-deep text-cut-base hover:bg-cut-deep/90 rounded-md transition-colors"
                        >
                          Start Here
                        </button>
                        <NudgeBtn label="+.1s" onClick={() => handleStartChange(Math.min(videoDuration, selectedClip.start + 0.1))} disabled={!selectedClip} />
                        <NudgeBtn label="+1s"  onClick={() => handleStartChange(Math.min(videoDuration, selectedClip.start + 1.0))} disabled={!selectedClip} />
                      </div>
                    </div>

                    {/* End Time */}
                    <div>
                      <p className="text-xs text-cut-mid mb-2">
                        End Time: <span className="font-mono font-semibold text-cut-deep">{formatTime(selectedClip.end)}</span>
                      </p>
                      <div className="flex items-center gap-1">
                        <NudgeBtn label="-1s"  onClick={() => handleEndChange(Math.max(0, selectedClip.end - 1.0))} disabled={!selectedClip} />
                        <NudgeBtn label="-.1s" onClick={() => handleEndChange(Math.max(0, selectedClip.end - 0.1))} disabled={!selectedClip} />
                        <button
                          onClick={handleSetEnd}
                          title="Hotkey: S"
                          className="flex-1 py-2 text-xs font-semibold bg-cut-deep text-cut-base hover:bg-cut-deep/90 rounded-md transition-colors"
                        >
                          End Here
                        </button>
                        <NudgeBtn label="+.1s" onClick={() => handleEndChange(Math.min(videoDuration, selectedClip.end + 0.1))} disabled={!selectedClip} />
                        <NudgeBtn label="+1s"  onClick={() => handleEndChange(Math.min(videoDuration, selectedClip.end + 1.0))} disabled={!selectedClip} />
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="pt-3 border-t border-cut-warm/30 space-y-1.5 text-xs">
                      <div className="flex justify-between text-cut-mid">
                        <span>Duration</span>
                        <span className="font-mono font-semibold text-cut-deep">{selectedClip.duration.toFixed(1)}s</span>
                      </div>
                      {selectedClip.statType && (
                        <div className="flex justify-between text-cut-mid">
                          <span>Stat</span>
                          <span className="font-medium text-cut-deep">{getStatLabel(selectedClip.statType)}</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-cut-muted">Select a clip to edit its timing.</p>
                )}
              </div>
            )}
          </div>

          {/* ═══ Player Overlay Modal ══════════════════════════════════ */}
          {showPlayerOverlay && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80" onClick={handlePlayerOverlayCancel}>
              <div className="bg-white border border-cut-warm/40 rounded-2xl p-4 w-64 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="text-sm font-semibold text-cut-deep mb-2">
                  {playerOverlayStat === 'error'
                    ? `Select player for ${getStatLabel(playerOverlayStat)}`
                    : playerOverlayStat === 'def_break' || playerOverlayStat === 'def_hold'
                      ? `Add touches (${getStatLabel(playerOverlayStat)})`
                      : `Select players for ${playerOverlayStat ? getStatLabel(playerOverlayStat) : ''}`}
                </div>
                {(playerOverlayStat === 'def_break' || playerOverlayStat === 'def_hold') && (
                  <p className="text-xs text-cut-mid mb-2">Click to add each touch in order.</p>
                )}
                {(playerOverlayStat === 'def_break' || playerOverlayStat === 'def_hold') && selectedPlayers.length > 0 && (
                  <div className="mb-2 flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-cut-mid">Seq:</span>
                    <span className="text-xs font-mono text-cut-deep">
                      {selectedPlayers.map((id, i) => (
                        <span key={`${id}-${i}`}>
                          {i > 0 && ' → '}
                          {matchSetup?.team1.players.find(p => p.id === id)?.name ?? matchSetup?.team2.players.find(p => p.id === id)?.name ?? id}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {(['A', 'B', 'C', 'D'] as const).map((playerId) => {
                    const playerName = matchSetup?.team1.players.find(p => p.id === playerId)?.name ?? matchSetup?.team2.players.find(p => p.id === playerId)?.name ?? `Player ${playerId}`
                    return (
                      <button
                        key={playerId}
                        onClick={() => togglePlayer(playerId)}
                        className={`px-2 py-2 rounded-lg transition-colors font-medium text-xs ${
                          playerOverlayStat === 'error' && selectedPlayers.includes(playerId)
                            ? 'bg-cut-deep text-cut-base'
                            : 'bg-cut-base text-cut-deep hover:bg-cut-warm/40 border border-cut-warm/40'
                        }`}
                      >
                        {playerId}: {playerName}
                      </button>
                    )
                  })}
                </div>
                <div className="flex justify-between gap-1">
                  <div>
                    {(playerOverlayStat === 'def_break' || playerOverlayStat === 'def_hold') && selectedPlayers.length > 0 && (
                      <button onClick={removeLastTouch} className="px-2 py-1.5 text-xs text-cut-mid hover:text-cut-deep transition-colors">
                        ← Undo
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 ml-auto">
                    <button onClick={handlePlayerOverlayCancel} className="px-2 py-1.5 text-xs text-cut-mid hover:text-cut-deep transition-colors rounded-lg">Cancel</button>
                    <button
                      onClick={handlePlayerOverlayConfirm}
                      disabled={selectedPlayers.length === 0}
                      className="px-3 py-1.5 text-xs bg-cut-deep hover:bg-cut-deep/90 text-cut-base rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ═══ Timeline ══════════════════════════════════════════════ */}
      <div className="flex-shrink-0 bg-white border-t border-cut-warm/40 px-4 py-2 flex flex-col h-[200px]">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-cut-mid uppercase tracking-wider">
              Timeline ({keptClips.length} kept / {clips.length} total)
            </span>
            <button
              type="button"
              onClick={openAddClipModal}
              className="px-2.5 py-1 text-xs font-medium bg-cut-deep text-cut-base hover:bg-cut-deep/90 rounded-lg transition-colors"
              title="Add a clip manually"
            >
              + Add
            </button>
          </div>
        </div>

        {clips.length > 0 ? (
          <div className="filmstrip-scroll flex gap-2 overflow-x-auto flex-1 min-h-0 pb-1">
            {clips.map((clip, index) => {
              const isTrashed  = clip.status === 'trash' || clip.keep === false
              const isSelected = index === selectedClipIndex
              const statLabel  = getStatLabel(clip.statType)
              const label      = statLabel || clip.tag
              const colors     = TAG_COLORS[clip.tag] ?? TAG_COLORS.Noise

              return (
                <button
                  key={index}
                  onClick={() => handleSelectClip(index)}
                  className={`
                    flex-shrink-0 w-36 p-2.5 rounded-xl border-2 transition-all duration-150 relative text-left
                    ${isTrashed
                      ? 'opacity-40 bg-cut-base border-cut-warm/30'
                      : isSelected
                        ? `${colors.bg} ${colors.border} ring-2 ring-cut-deep/20`
                        : 'bg-white border-cut-warm/30 hover:border-cut-warm/60'
                    }
                  `}
                >
                  {/* Trash / Restore button */}
                  {!isTrashed ? (
                    <button
                      onClick={(e) => handleTrashClip(index, e)}
                      className="absolute top-1.5 right-1.5 w-5 h-5 bg-cut-warm/30 hover:bg-rc-red/80 hover:text-white rounded flex items-center justify-center text-cut-muted transition-colors"
                      title="Trash clip"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleRestoreClip(index, e)}
                      className="absolute top-1.5 right-1.5 w-5 h-5 bg-green-100 hover:bg-green-200 text-green-700 rounded flex items-center justify-center text-xs transition-colors"
                      title="Restore clip"
                    >
                      ↩
                    </button>
                  )}

                  {/* Thumbnail placeholder */}
                  <div className="w-full aspect-video bg-cut-base rounded-lg mb-1.5 flex items-center justify-center text-xs text-cut-muted border border-cut-warm/20">
                    {isTrashed ? '✗' : clip.id || index + 1}
                  </div>

                  {/* Clip metadata */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold truncate ${isTrashed ? 'text-cut-muted' : colors.text}`}>
                      {label}
                    </span>
                    <span className="text-xs text-cut-muted flex-shrink-0 ml-1">{clip.duration.toFixed(1)}s</span>
                  </div>
                  <div className="text-xs text-cut-muted font-mono mt-0.5">{formatTime(clip.start)}</div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 items-center justify-center text-cut-muted text-sm">
            No clips yet — run the AI engine to detect rallies.
          </div>
        )}
      </div>


      {/* ═══ Keybinds Modal ════════════════════════════════════════ */}
      {showKeybindsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowKeybindsModal(false)}>
          <div className="bg-white border border-cut-warm/40 rounded-2xl p-6 w-96 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold text-cut-deep mb-4">Keyboard Shortcuts</div>
            <div className="space-y-2 text-sm">
              {[
                ['Set Start Here', 'W'], ['Set End Here', 'S'],
                ['Nudge Start −1.0s', 'Q'], ['Nudge Start +1.0s', 'E'],
                ['Nudge Start −0.1s', 'Shift+Q'], ['Nudge Start +0.1s', 'Shift+E'],
                ['Nudge End −1.0s', 'A'], ['Nudge End +1.0s', 'D'],
                ['Nudge End −0.1s', 'Shift+A'], ['Nudge End +0.1s', 'Shift+D'],
                ['Previous Clip', '←'], ['Next Clip', '→'],
                ['Trash Clip', 'Delete'], ['Play / Pause', 'Space'],
              ].map(([action, key]) => (
                <div key={action} className="flex justify-between">
                  <span className="text-cut-deep">{action}</span>
                  <span className="font-mono text-cut-mid bg-cut-base px-2 py-0.5 rounded text-xs">{key}</span>
                </div>
              ))}
              <div className="border-t border-cut-warm/40 pt-2 mt-2">
                <div className="text-xs text-cut-muted uppercase tracking-wider mb-2">Stats (keys 1–8)</div>
                {STAT_BUTTONS.map(s => (
                  <div key={s.key} className="flex justify-between">
                    <span className="text-cut-deep">{s.label}</span>
                    <span className="font-mono text-cut-mid bg-cut-base px-2 py-0.5 rounded text-xs">{s.key}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setShowKeybindsModal(false)} className="px-4 py-2 text-sm bg-cut-base hover:bg-cut-warm/40 text-cut-deep rounded-lg transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Project Settings Modal ════════════════════════════════ */}
      {showSettingsModal && matchSetup && (
        <ProjectSettingsModal
          project={project}
          matchSetup={matchSetup}
          onSave={handleSettingsSave}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* ═══ Upgrade Modal ═════════════════════════════════════════ */}
      {showUpgradeModal && (
        <UpgradeModal
          used={exportUsed}
          limit={exportLimit}
          reason={exportDenyReason}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}

      {/* ═══ Add Clip Modal ════════════════════════════════════════ */}
      {showAddClipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddClipModal(false)}>
          <div className="bg-white border border-cut-warm/40 rounded-2xl p-5 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-cut-deep mb-4">Add Clip</div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-cut-mid mb-1">Start time (seconds)</label>
                <input type="number" step="0.1" min={0} max={videoDuration} value={addClipStart} onChange={e => setAddClipStart(e.target.value)}
                  className="w-full px-3 py-2 bg-cut-base border border-cut-warm/40 rounded-lg text-cut-deep font-mono text-sm outline-none focus:border-cut-mid/50 focus:ring-1 focus:ring-cut-warm/30" />
              </div>
              <div>
                <label className="block text-xs text-cut-mid mb-1">End time (seconds)</label>
                <input type="number" step="0.1" min={0} max={videoDuration} value={addClipEnd} onChange={e => setAddClipEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-cut-base border border-cut-warm/40 rounded-lg text-cut-deep font-mono text-sm outline-none focus:border-cut-mid/50 focus:ring-1 focus:ring-cut-warm/30" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddClipModal(false)} className="px-3 py-1.5 text-sm text-cut-mid hover:text-cut-deep rounded-lg transition-colors">Cancel</button>
              <button type="button" onClick={handleAddClip} className="px-4 py-1.5 text-sm bg-cut-deep text-cut-base hover:bg-cut-deep/90 rounded-lg transition-colors font-medium">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Format seconds as M:SS.T */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`
}
