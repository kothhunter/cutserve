import { useState, useEffect, useRef } from 'react'
import type { Project } from '../App'
import type { BackgroundJob } from './BackgroundJobsBar'

interface DashboardProps {
  onOpenProject: (project: Project) => void
  backgroundJobs: BackgroundJob[]
  onStartProcessing: (project: Project) => Promise<void>
}

// ── Helpers ──────────────────────────────────────────────────────

function getConfigLabel(project: Project): string {
  switch (project.status) {
    case 'new':        return 'New Project'
    case 'zones-set':  return 'Zones Ready'
    case 'processing': return project.processingProgress ? `Processing ${project.processingProgress}%` : 'Processing…'
    case 'processed':  return 'Clips Ready'
    case 'edited':     return 'Clips Edited'
    case 'exported':   return 'Exported'
    default:           return 'Not Configured'
  }
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now  = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000
  if (diff < 60)     return 'Just now'
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString()
}

const STATUS_OPTIONS: { label: string; value: Project['status'] | 'all' }[] = [
  { label: 'All',        value: 'all' },
  { label: 'New',        value: 'new' },
  { label: 'Zones Set',  value: 'zones-set' },
  { label: 'Processing', value: 'processing' },
  { label: 'Processed',  value: 'processed' },
  { label: 'Edited',     value: 'edited' },
  { label: 'Exported',   value: 'exported' },
]

// ── Component ────────────────────────────────────────────────────

export function Dashboard({ onOpenProject, backgroundJobs, onStartProcessing }: DashboardProps) {
  const [projects, setProjects]           = useState<Project[]>([])
  const [loading, setLoading]             = useState(true)
  const [searchQuery, setSearchQuery]     = useState('')
  const [filterStatus, setFilterStatus]   = useState<Project['status'] | 'all'>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadProjects() }, [])

  // Re-sync project list whenever the window regains focus
  useEffect(() => {
    const handleFocus = () => loadProjects()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadProjects = async () => {
    try {
      if (!window.api) { setLoading(false); return }
      const list = await window.api.listProjects()
      setProjects(list)
    } catch (err) {
      console.error('Failed to load projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNewProject = async () => {
    try {
      if (!window.api) { alert('Error: App not properly initialized.'); return }
      const videoPath = await window.api.openVideoDialog()
      if (!videoPath) return
      const project = await window.api.createProject(videoPath)
      await loadProjects()
      onOpenProject(project)
    } catch (err) {
      alert(`Failed to create project: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this project? This cannot be undone.')) return
    try {
      await window.api.deleteProject(id)
      await loadProjects()
    } catch {
      alert('Failed to delete project')
    }
  }

  const canStartProcessing = (p: Project) =>
    p.status === 'zones-set' && !p.clipsJson && !backgroundJobs.some(j => j.type === 'processing' && j.projectId === p.id)

  const handleStartProcessing = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await onStartProcessing(project)
      await loadProjects()
    } catch (err) {
      await loadProjects()
      alert(`Failed to start processing: ${err}`)
    }
  }

  // Filtered + searched project list
  const filteredProjects = projects.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.videoName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterStatus === 'all' || p.status === filterStatus
    return matchesSearch && matchesFilter
  })

  // ── Status badge ──────────────────────────────────────────────
  const getStatusBadge = (project: Project) => {
    const base = 'px-2 py-0.5 text-xs rounded-full font-medium'
    // Check if there's a background job for this project
    const job = backgroundJobs.find(j => j.projectId === project.id)
    if (job?.type === 'processing') {
      return <span className={`${base} bg-blue-100 text-blue-700`}>
        Processing {job.progress ? `${job.progress}%` : '…'}
      </span>
    }
    if (job?.type === 'exporting') {
      return <span className={`${base} bg-purple-100 text-purple-700`}>
        Exporting {job.progress ? `${job.progress}%` : '…'}
      </span>
    }
    switch (project.status) {
      case 'new':
        return <span className={`${base} bg-cut-warm/40 text-cut-muted`}>New</span>
      case 'zones-set':
        return <span className={`${base} bg-green-100 text-green-700`}>Zones ✓</span>
      case 'processing': {
        const pct = project.processingProgress
        return <span className={`${base} bg-blue-100 text-blue-700`}>
          Processing {pct ? `${pct}%` : '…'}
        </span>
      }
      case 'processed':
        return <span className={`${base} bg-blue-100 text-blue-700`}>Clips ✓</span>
      case 'edited':
        return <span className={`${base} bg-yellow-100 text-yellow-700`}>Edited ✓</span>
      case 'exported':
        return <span className={`${base} bg-green-100 text-green-700`}>Exported ✓</span>
      default:
        return null
    }
  }

  // ── Primary action button per project ─────────────────────────
  const getActionButton = (project: Project) => {
    if (canStartProcessing(project)) {
      return (
        <button
          onClick={(e) => handleStartProcessing(project, e)}
          className="whitespace-nowrap h-10 px-5 bg-cut-deep text-cut-base text-sm font-semibold rounded-xl hover:bg-cut-deep/90 transition-all duration-200"
        >
          Start Processing
        </button>
      )
    }
    const label = (project.status === 'processed' || project.status === 'edited' || project.status === 'exported')
      ? 'Open Editor'
      : 'Open'
    return (
      <button
        onClick={() => onOpenProject(project)}
        className="whitespace-nowrap h-10 px-5 bg-cut-warm/30 text-cut-deep text-sm font-semibold rounded-xl hover:bg-cut-deep hover:text-cut-base transition-all duration-200"
      >
        {label}
      </button>
    )
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="h-full bg-cut-base overflow-y-auto">
      <div className="max-w-[1600px] mx-auto px-6 py-8">

        {/* ── Top Controls ──────────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center mb-8">

          {/* Search bar */}
          <div className="flex-[2] w-full bg-white flex items-center px-4 h-12 rounded-xl border border-cut-warm/40 focus-within:border-cut-mid/40 focus-within:ring-1 focus-within:ring-cut-warm/30 transition-all shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-cut-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects…"
              className="flex-1 bg-transparent border-none outline-none text-cut-deep placeholder-cut-muted/60 text-sm px-3 h-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-cut-muted hover:text-cut-deep transition-colors text-xl leading-none"
              >
                ×
              </button>
            )}
          </div>

          {/* Filter dropdown */}
          <div ref={filterRef} className="relative flex-shrink-0">
            <button
              onClick={() => setShowFilterMenu(v => !v)}
              className={`h-12 px-5 border text-sm font-medium rounded-xl transition-all shadow-sm flex items-center gap-2 ${
                filterStatus !== 'all'
                  ? 'bg-cut-deep text-cut-base border-cut-deep'
                  : 'bg-white border-cut-warm/40 text-cut-mid hover:bg-cut-base hover:text-cut-deep'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              {filterStatus !== 'all'
                ? STATUS_OPTIONS.find(o => o.value === filterStatus)?.label
                : 'Filter'}
            </button>

            {showFilterMenu && (
              <div className="absolute top-full mt-1 left-0 z-10 bg-white border border-cut-warm/40 rounded-xl shadow-lg py-1 min-w-[160px]">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilterStatus(opt.value as Project['status'] | 'all'); setShowFilterMenu(false) }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      filterStatus === opt.value
                        ? 'bg-cut-base text-cut-deep font-semibold'
                        : 'text-cut-mid hover:bg-cut-base hover:text-cut-deep'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden md:block flex-1" />

          {/* Refresh */}
          <button
            onClick={loadProjects}
            title="Refresh project list"
            className="h-12 w-12 flex items-center justify-center bg-white border border-cut-warm/40 text-cut-mid hover:bg-cut-base hover:text-cut-deep rounded-xl transition-colors shadow-sm flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* New Project */}
          <button
            onClick={handleNewProject}
            className="h-12 px-8 bg-cut-deep text-cut-base text-sm font-semibold rounded-xl hover:bg-cut-deep/90 transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
          >
            <span className="text-lg leading-none">+</span>
            New Project
          </button>
        </div>

        {/* ── Project List ──────────────────────────────────── */}
        {loading ? (
          <div className="text-center py-20 text-cut-mid text-sm">Loading projects…</div>

        ) : filteredProjects.length > 0 ? (
          <div className="flex flex-col gap-3">
            {filteredProjects.map(project => (
              <div
                key={project.id}
                onClick={() => onOpenProject(project)}
                className="group w-full bg-white rounded-2xl border border-cut-warm/30 p-4 flex items-center gap-6 hover:shadow-md hover:shadow-cut-warm/25 hover:border-cut-warm/60 transition-all duration-200 cursor-pointer"
              >
                {/* Thumbnail */}
                <div className="w-40 aspect-video bg-cut-base rounded-xl flex-shrink-0 flex items-center justify-center border border-cut-warm/20 overflow-hidden group-hover:border-cut-warm/40 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-cut-warm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>

                {/* Name + Status */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-cut-deep text-lg tracking-tight truncate">
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(project)}
                    <span className="text-xs text-cut-muted truncate">{project.videoName}</span>
                  </div>
                </div>



                {/* Last Opened */}
                <div className="hidden md:flex flex-col items-end w-28 flex-shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-cut-muted font-bold">Opened</span>
                  <span className="text-sm font-medium text-cut-deep mt-0.5">{getRelativeTime(project.updatedAt)}</span>
                </div>

                {/* Actions — stopPropagation prevents the row click from firing */}
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {getActionButton(project)}
                  <button
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    className="w-10 h-10 flex items-center justify-center text-cut-muted hover:text-rc-red hover:bg-red-50 rounded-xl transition-colors"
                    title="Delete project"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

        ) : projects.length === 0 ? (
          /* Empty state — no projects exist yet */
          <div className="py-24 flex flex-col items-center justify-center border-2 border-dashed border-cut-warm/40 rounded-2xl bg-white/60">
            <div className="w-16 h-16 bg-cut-warm/30 rounded-full flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-cut-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="font-semibold text-cut-deep text-lg">No projects yet</p>
            <p className="text-cut-mid text-sm mt-1">Import your first video to get started</p>
            <p className="text-cut-muted text-xs mt-1">MP4 files only</p>
            <button
              onClick={handleNewProject}
              className="mt-6 h-11 px-8 bg-cut-deep text-cut-base text-sm font-semibold rounded-xl hover:bg-cut-deep/90 transition-colors flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span>
              New Project
            </button>
          </div>

        ) : (
          /* No results from current search / filter */
          <div className="py-16 flex flex-col items-center justify-center">
            <p className="text-cut-mid text-sm">No projects match your search.</p>
            <button
              onClick={() => { setSearchQuery(''); setFilterStatus('all') }}
              className="mt-3 text-sm text-cut-deep underline underline-offset-2 hover:text-cut-mid transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
