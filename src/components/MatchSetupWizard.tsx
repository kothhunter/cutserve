import { useState } from 'react'
import type { MatchSetup, Player, ServingStyle, Team } from '../types/match'

const DEFAULT_COLORS = ['#4a9eff', '#ff6b6b']

interface MatchSetupWizardProps {
  projectId: string
  onComplete: (setup: MatchSetup) => void
}

type Step = 'teams' | 'players' | 'starting-position' | 'rules'

const STEP_LABELS: Record<Step, string> = {
  'teams': 'Teams',
  'players': 'Players',
  'starting-position': 'Starting Position',
  'rules': 'Rules',
}

export function MatchSetupWizard({ projectId, onComplete }: MatchSetupWizardProps) {
  const [step,               setStep]               = useState<Step>('teams')
  const [team1Name,          setTeam1Name]          = useState('Team 1')
  const [team2Name,          setTeam2Name]          = useState('Team 2')
  const [team1Color,         setTeam1Color]         = useState(DEFAULT_COLORS[0])
  const [team2Color,         setTeam2Color]         = useState(DEFAULT_COLORS[1])
  const [playerAName,        setPlayerAName]        = useState('Player A')
  const [playerBName,        setPlayerBName]        = useState('Player B')
  const [playerCName,        setPlayerCName]        = useState('Player C')
  const [playerDName,        setPlayerDName]        = useState('Player D')
  const [firstServerId,      setFirstServerId]      = useState<string>('A')
  const [firstReceiverId,    setFirstReceiverId]    = useState<string>('C')
  const [servingStyle,       setServingStyle]       = useState<ServingStyle>('traditional')
  const [targetScore,        setTargetScore]        = useState(21)

  const players: Player[] = [
    { id: 'A', name: playerAName, teamId: 'team1' },
    { id: 'B', name: playerBName, teamId: 'team1' },
    { id: 'C', name: playerCName, teamId: 'team2' },
    { id: 'D', name: playerDName, teamId: 'team2' },
  ]

  const team1: Team = { id: 'team1', name: team1Name, color: team1Color, players: [players[0], players[1]] }
  const team2: Team = { id: 'team2', name: team2Name, color: team2Color, players: [players[2], players[3]] }

  const getOpponents = (id: string) => (id === 'A' || id === 'B' ? ['C', 'D'] : ['A', 'B'])

  const playerName = (id: string) =>
    id === 'A' ? playerAName : id === 'B' ? playerBName : id === 'C' ? playerCName : playerDName

  const handleFinish = async () => {
    const setup: MatchSetup = { team1, team2, servingStyle, targetScore, firstServerId, firstReceiverId }
    await window.api.writeMatchSetup(projectId, setup)
    onComplete(setup)
  }

  const steps: Step[] = ['teams', 'players', 'starting-position', 'rules']
  const stepIndex = steps.indexOf(step)

  // ── Input / button base classes ──────────────────────────────────
  const inputCls = 'w-full max-w-md px-4 py-2.5 bg-white border border-cut-warm/40 rounded-xl text-cut-deep text-sm outline-none focus:border-cut-mid/50 focus:ring-1 focus:ring-cut-warm/30 transition-all'
  const labelCls = 'block text-sm font-medium text-cut-mid mb-1.5'
  const optionBtn = (active: boolean) =>
    `px-5 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
      active
        ? 'bg-cut-deep text-cut-base border-cut-deep'
        : 'bg-white text-cut-deep border-cut-warm/40 hover:bg-cut-base'
    }`

  return (
    <div className="h-full flex flex-col bg-cut-base text-cut-deep overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-6 py-8 flex flex-col gap-6 min-h-full">

        {/* ── Step header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-cut-deep">Match Setup</h2>
          <div className="flex gap-1.5">
            {steps.map((s) => (
              <button
                key={s}
                onClick={() => setStep(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                  step === s
                    ? 'bg-cut-deep text-cut-base border-cut-deep'
                    : 'bg-white text-cut-mid border-cut-warm/40 hover:bg-cut-base hover:text-cut-deep'
                }`}
              >
                {STEP_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Step progress bar ────────────────────────────────── */}
        <div className="flex gap-1">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-cut-deep' : 'bg-cut-warm/40'
              }`}
            />
          ))}
        </div>

        {/* ── Step content ─────────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-2xl border border-cut-warm/30 p-6">

          {step === 'teams' && (
            <div className="space-y-5">
              <div>
                <label className={labelCls}>Team 1 Name</label>
                <input type="text" value={team1Name} onChange={e => setTeam1Name(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Team 1 Colour</label>
                <input type="color" value={team1Color} onChange={e => setTeam1Color(e.target.value)} className="w-14 h-10 rounded-lg cursor-pointer border border-cut-warm/40 p-0.5" />
              </div>
              <div className="border-t border-cut-warm/30 pt-5">
                <label className={labelCls}>Team 2 Name</label>
                <input type="text" value={team2Name} onChange={e => setTeam2Name(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Team 2 Colour</label>
                <input type="color" value={team2Color} onChange={e => setTeam2Color(e.target.value)} className="w-14 h-10 rounded-lg cursor-pointer border border-cut-warm/40 p-0.5" />
              </div>
            </div>
          )}

          {step === 'players' && (
            <div className="space-y-5">
              <p className="text-sm font-semibold text-cut-deep">{team1Name}</p>
              <div>
                <label className={labelCls}>Player 1</label>
                <input type="text" value={playerAName} onChange={e => setPlayerAName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Player 2</label>
                <input type="text" value={playerBName} onChange={e => setPlayerBName(e.target.value)} className={inputCls} />
              </div>
              <div className="border-t border-cut-warm/30 pt-5">
                <p className="text-sm font-semibold text-cut-deep mb-4">{team2Name}</p>
                <label className={labelCls}>Player 3</label>
                <input type="text" value={playerCName} onChange={e => setPlayerCName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Player 4</label>
                <input type="text" value={playerDName} onChange={e => setPlayerDName(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          {step === 'starting-position' && (
            <div className="space-y-6">
              <div>
                <label className={labelCls}>Who Serves First?</label>
                <div className="flex gap-2 flex-wrap">
                  {['A', 'B', 'C', 'D'].map(id => (
                    <button key={id} onClick={() => { setFirstServerId(id); setFirstReceiverId(getOpponents(id)[0]) }} className={optionBtn(firstServerId === id)}>
                      {playerName(id)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Who Receives First?</label>
                <div className="flex gap-2 flex-wrap">
                  {getOpponents(firstServerId).map(id => (
                    <button key={id} onClick={() => setFirstReceiverId(id)} className={optionBtn(firstReceiverId === id)}>
                      {playerName(id)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'rules' && (
            <div className="space-y-6">
              <div>
                <label className={labelCls}>Serving Style</label>
                <div className="flex gap-3">
                  <button onClick={() => setServingStyle('traditional')} className={optionBtn(servingStyle === 'traditional')}>Traditional</button>
                  <button onClick={() => setServingStyle('equal')}       className={optionBtn(servingStyle === 'equal')}>Equal</button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Target Score</label>
                <input
                  type="number"
                  min={11} max={31}
                  value={targetScore}
                  onChange={e => setTargetScore(Math.max(11, Math.min(31, parseInt(e.target.value) || 21)))}
                  className="w-28 px-4 py-2.5 bg-white border border-cut-warm/40 rounded-xl text-cut-deep text-sm outline-none focus:border-cut-mid/50"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation ───────────────────────────────────────── */}
        <div className="flex justify-between pt-2 border-t border-cut-warm/30">
          <button
            onClick={() => { if (stepIndex > 0) setStep(steps[stepIndex - 1]) }}
            disabled={step === 'teams'}
            className="h-10 px-5 text-sm font-medium bg-white border border-cut-warm/40 text-cut-mid hover:bg-cut-base hover:text-cut-deep rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Back
          </button>

          {step !== 'rules' ? (
            <button
              onClick={() => { if (stepIndex < steps.length - 1) setStep(steps[stepIndex + 1]) }}
              className="h-10 px-5 text-sm font-semibold bg-cut-deep text-cut-base hover:bg-cut-deep/90 rounded-xl transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="h-10 px-6 text-sm font-semibold bg-cut-deep text-cut-base hover:bg-cut-deep/90 rounded-xl transition-colors"
            >
              Start Editing →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
