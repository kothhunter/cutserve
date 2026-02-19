import { useState, useEffect } from 'react'
import { Dashboard } from './components/Dashboard'
import { ZoneWizard } from './components/ZoneWizard'
import { MatchSetupWizard } from './components/MatchSetupWizard'
import { Editor } from './components/Editor'
import { Export } from './pages/Export'
import { LoginScreen } from './components/LoginScreen'
import { MatchProvider } from './context/MatchContext'
import type { MatchSetup } from './types/match'
import logoSvg from '/logo/CUT.svg'

/** Top-level views in the app */
type View = 'dashboard' | 'zone-wizard' | 'match-setup' | 'editor' | 'export'

/** Auth state */
type AuthState = 'loading' | 'unauthenticated' | 'authenticated'

/** Minimal project shape */
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

/** Clip data coming from the Python engine */
export interface Clip {
  id?: number  // Sequential ID starting at 1 (for stat tracking)
  start: number
  end: number
  duration: number
  tag: 'Rally' | 'Serve' | 'Noise'
  confidence: 'High' | 'Medium' | 'Low'
  peak_energy: number
  keep?: boolean  // Legacy field - use status instead
  status?: 'pending' | 'done' | 'trash'
  statType?: 'ace' | 'def_break' | 'sideout' | 'double_fault' | 'service_break' | 'def_hold' | 'error' | 'none'
  involvedPlayers?: string[]
}

export interface UserProfile {
  id: string
  email: string
  plan: 'free' | 'pro' | 'lifetime'
  exports_this_month: number
  exports_reset_at: string
}

export default function App() {
  const [authState, setAuthState]     = useState<AuthState>('loading')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const [view, setView]               = useState<View>('dashboard')
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [clips, setClips]             = useState<Clip[]>([])
  const [matchSetup, setMatchSetup]   = useState<MatchSetup | null>(null)

  // ── Restore session on mount ─────────────────────────────────────
  useEffect(() => {
    window.api.auth.restore().then(async (ok) => {
      if (ok) {
        const profile = await window.api.auth.getProfile()
        setUserProfile(profile as UserProfile | null)
        setAuthState('authenticated')
      } else {
        setAuthState('unauthenticated')
      }
    })
  }, [])

  const handleAuthenticated = async () => {
    const profile = await window.api.auth.getProfile()
    setUserProfile(profile as UserProfile | null)
    setAuthState('authenticated')
  }

  const handleLogout = async () => {
    await window.api.auth.logout()
    setShowProfileMenu(false)
    setUserProfile(null)
    setView('dashboard')
    setActiveProject(null)
    setClips([])
    setMatchSetup(null)
    setAuthState('unauthenticated')
  }

  // ── View navigation ─────────────────────────────────────────────
  const handleOpenProject = async (project: Project) => {
    setActiveProject(project)

    if (project.status === 'new' || project.status === 'zones-set' || project.status === 'processing') {
      // Check video exists before entering zone wizard
      const videoUrl = await window.api.getVideoUrl(project.id)
      if (!videoUrl) {
        alert(`Source video not found.\n\nThe original video file may have been moved or deleted:\n${project.videoPath}`)
        setActiveProject(null)
        return
      }
      setView('zone-wizard')
    } else if (project.status === 'processed' || project.status === 'edited' || project.status === 'exported') {
      const [clipsData, setup] = await Promise.all([
        window.api.readClips(project.id).catch(() => ({ clips: [] })),
        window.api.readMatchSetup(project.id),
      ])
      setClips(clipsData.clips || [])
      if (clipsData.video_path && typeof clipsData.video_path === 'string') {
        setActiveProject((prev) => prev ? { ...prev, videoPath: clipsData.video_path } : null)
        await window.api.updateProject(project.id, { videoPath: clipsData.video_path })
      }
      // Check video exists before entering editor
      const videoUrl = await window.api.getVideoUrl(project.id)
      if (!videoUrl) {
        alert(`Source video not found.\n\nThe original video file may have been moved or deleted:\n${project.videoPath}`)
        setActiveProject(null)
        setClips([])
        return
      }
      setMatchSetup(setup as MatchSetup | null)
      setView(setup ? 'editor' : 'match-setup')
    } else {
      setView('zone-wizard')
    }
  }

  const handleZonesComplete = async () => {
    setView('dashboard')
  }

  const handleBackToDashboard = () => {
    setView('dashboard')
    setActiveProject(null)
    setClips([])
    setMatchSetup(null)
  }

  const handleMatchSetupComplete = (setup: MatchSetup) => {
    setMatchSetup(setup)
    setView('editor')
  }

  const handleOpenExportStudio = () => {
    setView('export')
  }

  const handleBackFromExport = () => {
    setView('editor')
  }

  // Build breadcrumb label for the current view
  const pageLabel: Record<View, string> = {
    'dashboard': '',
    'zone-wizard': 'Zone Setup',
    'match-setup': 'Match Setup',
    'editor': 'Editor',
    'export': 'Broadcast Studio',
  }

  // ── Auth gate ────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-cut-base">
        <div className="text-center space-y-3">
          <img src={logoSvg} alt="CutServe" className="h-12 w-auto mx-auto opacity-60 animate-pulse" />
          <p className="text-sm text-cut-muted">Loading…</p>
        </div>
      </div>
    )
  }

  if (authState === 'unauthenticated') {
    return <LoginScreen onAuthenticated={handleAuthenticated} />
  }

  // ── Authenticated shell ──────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-cut-base text-cut-deep overflow-hidden">
      {/* ── Title Bar / Navigation ─────────────────────────────── */}
      <header className="drag-region flex-shrink-0 flex items-center justify-between px-6 h-16 bg-white border-b border-cut-warm/50">
        {/* Left: logo + app name + breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={logoSvg}
            alt="CutServe"
            className="h-10 w-auto flex-shrink-0"
          />
          <span className="text-cut-deep font-semibold text-lg tracking-tight">CutServe</span>
          {activeProject && (
            <div className="flex items-center text-sm ml-1 min-w-0 truncate">
              <span className="text-cut-warm mx-1">/</span>
              <span className="text-cut-mid truncate">{activeProject.name}</span>
              {view !== 'dashboard' && (
                <>
                  <span className="text-cut-warm mx-1">/</span>
                  <span className="text-cut-mid font-medium">{pageLabel[view]}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: action buttons */}
        <nav className="no-drag flex items-center gap-3 flex-shrink-0">
          {/* Upgrade — opens pricing page */}
          {userProfile?.plan === 'free' && (
            <button
              onClick={() => window.api.openExternal('https://cutserve.app/pricing')}
              className="h-9 px-5 bg-cut-deep text-cut-base text-sm font-semibold rounded-lg hover:bg-cut-deep/90 transition-colors"
            >
              Upgrade
            </button>
          )}

          {/* Wiki / Guides — opens docs */}
          <button
            onClick={() => window.api.openExternal('https://cutserve.app/docs')}
            className="h-9 px-4 border border-cut-warm text-cut-mid text-sm font-medium rounded-lg bg-cut-base hover:bg-white hover:text-cut-deep transition-colors"
          >
            Wiki / Guides
          </button>

          {/* Return to Dashboard (all non-dashboard views) or Profile avatar (dashboard) */}
          {view !== 'dashboard' ? (
            <button
              onClick={handleBackToDashboard}
              className="h-9 px-4 bg-cut-warm/30 text-cut-deep text-sm font-medium rounded-lg hover:bg-cut-warm transition-colors"
            >
              Return to Dashboard
            </button>
          ) : (
            /* Profile menu */
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="no-drag w-9 h-9 rounded-full bg-cut-warm/40 flex items-center justify-center text-cut-mid hover:bg-cut-warm/60 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-11 w-56 bg-white border border-cut-warm/40 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-cut-warm/30">
                    <p className="text-xs font-semibold text-cut-deep truncate">{userProfile?.email}</p>
                    <p className="text-xs text-cut-mid mt-0.5 capitalize">{userProfile?.plan ?? 'free'} plan</p>
                  </div>
                  {userProfile?.plan === 'free' && (
                    <button
                      onClick={() => { setShowProfileMenu(false); window.api.openExternal('https://cutserve.app/pricing') }}
                      className="w-full text-left px-4 py-2.5 text-sm text-cut-deep hover:bg-cut-base transition-colors"
                    >
                      Upgrade to Pro →
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden" onClick={() => showProfileMenu && setShowProfileMenu(false)}>
        {view === 'dashboard' && (
          <Dashboard onOpenProject={handleOpenProject} />
        )}

        {view === 'zone-wizard' && activeProject && (
          <ZoneWizard
            project={activeProject}
            onComplete={handleZonesComplete}
          />
        )}

        {view === 'match-setup' && activeProject && (
          <MatchSetupWizard
            projectId={activeProject.id}
            onComplete={handleMatchSetupComplete}
          />
        )}

        {view === 'editor' && activeProject && matchSetup && (
          <MatchProvider
            matchSetup={matchSetup}
            setMatchSetup={setMatchSetup}
            clips={clips}
          >
            <Editor
              project={activeProject}
              clips={clips}
              onClipsChange={setClips}
              onOpenExportStudio={handleOpenExportStudio}
              onProjectUpdate={(name) => setActiveProject(prev => prev ? { ...prev, name } : null)}
            />
          </MatchProvider>
        )}

        {view === 'export' && activeProject && matchSetup && (
          <MatchProvider
            matchSetup={matchSetup}
            setMatchSetup={setMatchSetup}
            clips={clips}
          >
            <Export
              project={activeProject}
              matchSetup={matchSetup}
              clips={clips}
              onBack={handleBackFromExport}
            />
          </MatchProvider>
        )}
      </main>
    </div>
  )
}
