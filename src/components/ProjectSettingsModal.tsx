import { useState } from 'react'
import type { MatchSetup, ServingStyle } from '../types/match'
import type { Project } from '../App'

interface ProjectSettingsModalProps {
  project: Project
  matchSetup: MatchSetup
  onSave: (projectName: string, updatedSetup: MatchSetup) => void
  onClose: () => void
}

export function ProjectSettingsModal({ project, matchSetup, onSave, onClose }: ProjectSettingsModalProps) {
  // ── Project ──────────────────────────────────────────────────────
  const [projectName, setProjectName] = useState(project.name)

  // ── Teams ────────────────────────────────────────────────────────
  const [team1Name, setTeam1Name] = useState(matchSetup.team1.name)
  const [team2Name, setTeam2Name] = useState(matchSetup.team2.name)

  // ── Players ──────────────────────────────────────────────────────
  const [playerA, setPlayerA] = useState(matchSetup.team1.players.find(p => p.id === 'A')?.name ?? 'Player A')
  const [playerB, setPlayerB] = useState(matchSetup.team1.players.find(p => p.id === 'B')?.name ?? 'Player B')
  const [playerC, setPlayerC] = useState(matchSetup.team2.players.find(p => p.id === 'C')?.name ?? 'Player C')
  const [playerD, setPlayerD] = useState(matchSetup.team2.players.find(p => p.id === 'D')?.name ?? 'Player D')

  // ── Serving ──────────────────────────────────────────────────────
  const [firstServerId,   setFirstServerId]   = useState(matchSetup.firstServerId)
  const [firstReceiverId, setFirstReceiverId] = useState(matchSetup.firstReceiverId)
  const [servingStyle,    setServingStyle]    = useState<ServingStyle>(matchSetup.servingStyle)

  const [saving, setSaving] = useState(false)

  const playerName = (id: string) => {
    if (id === 'A') return playerA
    if (id === 'B') return playerB
    if (id === 'C') return playerC
    return playerD
  }

  const getOpponents = (id: string) => (id === 'A' || id === 'B' ? ['C', 'D'] : ['A', 'B'])

  const handleServerChange = (id: string) => {
    setFirstServerId(id)
    setFirstReceiverId(getOpponents(id)[0])
  }

  const handleSave = async () => {
    if (!projectName.trim()) return
    setSaving(true)

    const updatedSetup: MatchSetup = {
      ...matchSetup,
      team1: {
        ...matchSetup.team1,
        name: team1Name,
        players: [
          { id: 'A', name: playerA, teamId: 'team1' },
          { id: 'B', name: playerB, teamId: 'team1' },
        ],
      },
      team2: {
        ...matchSetup.team2,
        name: team2Name,
        players: [
          { id: 'C', name: playerC, teamId: 'team2' },
          { id: 'D', name: playerD, teamId: 'team2' },
        ],
      },
      firstServerId,
      firstReceiverId,
      servingStyle,
    }

    onSave(projectName.trim(), updatedSetup)
    setSaving(false)
  }

  // ── Shared styles ────────────────────────────────────────────────
  const inputCls = 'w-full px-3 py-2 bg-cut-base border border-cut-warm/50 rounded-lg text-cut-deep text-sm outline-none focus:border-cut-mid/50 focus:ring-1 focus:ring-cut-warm/30 transition-all'
  const labelCls = 'block text-xs font-semibold text-cut-mid uppercase tracking-wide mb-1'
  const sectionCls = 'space-y-3'
  const headingCls = 'text-sm font-bold text-cut-deep pb-1 border-b border-cut-warm/30'

  const optionBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
      active
        ? 'bg-cut-deep text-cut-base border-cut-deep'
        : 'bg-white text-cut-deep border-cut-warm/40 hover:bg-cut-base'
    }`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-white rounded-2xl border border-cut-warm/40 shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cut-warm/30">
          <h2 className="text-base font-bold text-cut-deep">Project Settings</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-cut-muted hover:bg-cut-base hover:text-cut-deep transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">

          {/* ── Project ──────────────────────────────────────── */}
          <div className={sectionCls}>
            <p className={headingCls}>Project</p>
            <div>
              <label className={labelCls}>Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* ── Teams & Players ───────────────────────────────── */}
          <div className={sectionCls}>
            <p className={headingCls}>Teams &amp; Players</p>

            {/* Team 1 */}
            <div className="space-y-2">
              <div>
                <label className={labelCls}>Team 1 Name</label>
                <input type="text" value={team1Name} onChange={e => setTeam1Name(e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Player A</label>
                  <input type="text" value={playerA} onChange={e => setPlayerA(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Player B</label>
                  <input type="text" value={playerB} onChange={e => setPlayerB(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-cut-warm/20 pt-2 space-y-2">
              <div>
                <label className={labelCls}>Team 2 Name</label>
                <input type="text" value={team2Name} onChange={e => setTeam2Name(e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Player C</label>
                  <input type="text" value={playerC} onChange={e => setPlayerC(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Player D</label>
                  <input type="text" value={playerD} onChange={e => setPlayerD(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Serving Setup ─────────────────────────────────── */}
          <div className={sectionCls}>
            <p className={headingCls}>Serving Setup</p>

            <div>
              <label className={labelCls}>First Server</label>
              <div className="flex gap-2 flex-wrap">
                {['A', 'B', 'C', 'D'].map(id => (
                  <button key={id} onClick={() => handleServerChange(id)} className={optionBtn(firstServerId === id)}>
                    {id}: {playerName(id)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>First Receiver</label>
              <div className="flex gap-2 flex-wrap">
                {getOpponents(firstServerId).map(id => (
                  <button key={id} onClick={() => setFirstReceiverId(id)} className={optionBtn(firstReceiverId === id)}>
                    {id}: {playerName(id)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Serving Style</label>
              <div className="flex gap-2">
                <button onClick={() => setServingStyle('traditional')} className={optionBtn(servingStyle === 'traditional')}>
                  Traditional
                </button>
                <button onClick={() => setServingStyle('equal')} className={optionBtn(servingStyle === 'equal')}>
                  Equal
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-cut-warm/30 bg-cut-base">
          <button
            onClick={onClose}
            className="h-9 px-5 text-sm font-medium text-cut-mid hover:text-cut-deep bg-white border border-cut-warm/40 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !projectName.trim()}
            className="h-9 px-5 text-sm font-semibold bg-cut-deep text-cut-base hover:bg-cut-deep/90 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
