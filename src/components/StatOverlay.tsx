import type { MatchStats } from '../core/stats'
import type { MatchSetup } from '../types/match'

interface StatOverlayProps {
  stats: MatchStats
  matchSetup: MatchSetup
  /** Compact mode for embedding in smaller previews (hides team totals) */
  compact?: boolean
  /** Show team total columns */
  showTeamTotals?: boolean
  /** Large mode for full-screen stat screen export (1920x1080) */
  size?: 'compact' | 'normal' | 'large'
}

/** Compute team totals from player stats */
function getTeamTotals(stats: MatchStats, matchSetup: MatchSetup) {
  const team1Ids = matchSetup.team1.players.map((p) => p.id)
  const team2Ids = matchSetup.team2.players.map((p) => p.id)

  const sum = (ids: string[], fn: (p: MatchStats['players'][string]) => number) =>
    ids.reduce((acc, id) => acc + (fn(stats.players[id]) ?? 0), 0)

  return {
    team1: {
      totalRpr: sum(team1Ids, (p) => p.rpr.total),
      aces: sum(team1Ids, (p) => p.aces),
      errors: sum(team1Ids, (p) => p.errors),
      defTouches: sum(team1Ids, (p) => p.defTouchesReturned + p.defTouchesNotReturned),
    },
    team2: {
      totalRpr: sum(team2Ids, (p) => p.rpr.total),
      aces: sum(team2Ids, (p) => p.aces),
      errors: sum(team2Ids, (p) => p.errors),
      defTouches: sum(team2Ids, (p) => p.defTouchesReturned + p.defTouchesNotReturned),
    },
  }
}

export function StatOverlay({ stats, matchSetup, compact = false, showTeamTotals = true, size }: StatOverlayProps) {
  const team1Players = matchSetup.team1.players
  const team2Players = matchSetup.team2.players
  const teamTotals = getTeamTotals(stats, matchSetup)
  const getPlayerStats = (playerId: string) => stats.players[playerId]

  /** Column order: Player A, Player B, Team A, Player C, Player D, Team B */
  const columns = showTeamTotals
    ? [
        ...team1Players.map((p) => ({ type: 'player' as const, player: p })),
        { type: 'team' as const, teamId: 'team1' as const },
        ...team2Players.map((p) => ({ type: 'player' as const, player: p })),
        { type: 'team' as const, teamId: 'team2' as const },
      ]
    : [...team1Players, ...team2Players].map((p) => ({ type: 'player' as const, player: p }))

  const rows: { metric: string; getValue: (playerId: string) => string; getTeam1: () => string; getTeam2: () => string; highlight?: boolean }[] = [
    {
      metric: 'Breaks : Broken',
      getValue: (id) => {
        const p = getPlayerStats(id)
        return p ? `${p.breaks} : ${p.broken}` : '-'
      },
      getTeam1: () => {
        const breaks = team1Players.reduce((a, p) => a + (stats.players[p.id]?.breaks ?? 0), 0)
        const broken = team1Players.reduce((a, p) => a + (stats.players[p.id]?.broken ?? 0), 0)
        return `${breaks} : ${broken}`
      },
      getTeam2: () => {
        const breaks = team2Players.reduce((a, p) => a + (stats.players[p.id]?.breaks ?? 0), 0)
        const broken = team2Players.reduce((a, p) => a + (stats.players[p.id]?.broken ?? 0), 0)
        return `${breaks} : ${broken}`
      },
    },
    {
      metric: 'Aces : Aced',
      getValue: (id) => {
        const p = getPlayerStats(id)
        return p ? `${p.aces} : ${p.acedCount}` : '-'
      },
      getTeam1: () => {
        const t1 = matchSetup.team1.players
        const aces = t1.reduce((a, p) => a + (stats.players[p.id]?.aces ?? 0), 0)
        const aced = t1.reduce((a, p) => a + (stats.players[p.id]?.acedCount ?? 0), 0)
        return `${aces} : ${aced}`
      },
      getTeam2: () => {
        const t2 = matchSetup.team2.players
        const aces = t2.reduce((a, p) => a + (stats.players[p.id]?.aces ?? 0), 0)
        const aced = t2.reduce((a, p) => a + (stats.players[p.id]?.acedCount ?? 0), 0)
        return `${aces} : ${aced}`
      },
    },
    {
      metric: 'Serve %',
      getValue: (id) => {
        const p = getPlayerStats(id)
        if (!p || p.totalServes === 0) return '-'
        const pct = Math.round((p.servesOn / p.totalServes) * 100)
        return `${pct}% (${p.servesOn}/${p.totalServes})`
      },
      getTeam1: () => {
        const t1 = matchSetup.team1.players
        const on = t1.reduce((a, p) => a + (stats.players[p.id]?.servesOn ?? 0), 0)
        const tot = t1.reduce((a, p) => a + (stats.players[p.id]?.totalServes ?? 0), 0)
        return tot ? `${Math.round((on / tot) * 100)}% (${on}/${tot})` : '-'
      },
      getTeam2: () => {
        const t2 = matchSetup.team2.players
        const on = t2.reduce((a, p) => a + (stats.players[p.id]?.servesOn ?? 0), 0)
        const tot = t2.reduce((a, p) => a + (stats.players[p.id]?.totalServes ?? 0), 0)
        return tot ? `${Math.round((on / tot) * 100)}% (${on}/${tot})` : '-'
      },
    },
    {
      metric: 'Holds : Receives',
      getValue: (id) => {
        const p = getPlayerStats(id)
        return p ? `${p.holds} : ${p.receives}` : '-'
      },
      getTeam1: () => {
        const t1 = matchSetup.team1.players
        const holds = t1.reduce((a, p) => a + (stats.players[p.id]?.holds ?? 0), 0)
        const recv = t1.reduce((a, p) => a + (stats.players[p.id]?.receives ?? 0), 0)
        return `${holds} : ${recv}`
      },
      getTeam2: () => {
        const t2 = matchSetup.team2.players
        const holds = t2.reduce((a, p) => a + (stats.players[p.id]?.holds ?? 0), 0)
        const recv = t2.reduce((a, p) => a + (stats.players[p.id]?.receives ?? 0), 0)
        return `${holds} : ${recv}`
      },
    },
    {
      metric: 'Errors',
      getValue: (id) => {
        const p = getPlayerStats(id)
        return p ? String(p.errors) : '-'
      },
      getTeam1: () => String(teamTotals.team1.errors),
      getTeam2: () => String(teamTotals.team2.errors),
    },
    {
      metric: 'Defensive Touches',
      getValue: (id) => {
        const p = getPlayerStats(id)
        return p ? String(p.defTouchesReturned + p.defTouchesNotReturned) : '-'
      },
      getTeam1: () => String(teamTotals.team1.defTouches),
      getTeam2: () => String(teamTotals.team2.defTouches),
    },
    {
      metric: 'Total RPR',
      getValue: (id) => {
        const p = getPlayerStats(id)
        return p ? String(p.rpr.total) : '-'
      },
      getTeam1: () => '', // No team total for RPR
      getTeam2: () => '',
      highlight: true,
    },
  ]

  const textSize = compact ? 'text-xs' : size === 'large' ? 'text-2xl' : 'text-sm'
  const padding = compact ? 'px-2 py-1' : size === 'large' ? 'px-8 py-4' : 'px-4 py-2'

  return (
    <div className={`w-full overflow-x-auto rounded-lg border border-gray-600 bg-rc-dark/95 backdrop-blur-sm ${compact ? 'max-w-md' : size === 'large' ? 'max-w-[1680px]' : ''}`}>
      <table className={`w-full border-collapse ${textSize}`}>
        <thead>
          <tr className="border-b border-gray-600">
            <th className={`${padding} text-left font-semibold text-gray-400`}>Metric</th>
            {columns.map((col) =>
              col.type === 'player' ? (
                <th
                  key={col.player.id}
                  className={`border-l border-gray-600 ${padding} text-center font-medium text-gray-300`}
                >
                  {col.player.name}
                </th>
              ) : (
                <th
                  key={col.teamId}
                  className={`border-l-2 border-gray-500 ${padding} text-center font-semibold text-gray-300`}
                >
                  {matchSetup[col.teamId].name}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.metric}
              className={`border-b border-gray-600 last:border-b-0 ${
                row.highlight ? 'bg-rc-surface/80' : ''
              }`}
            >
              <td
                className={`${padding} text-gray-300 ${
                  row.highlight ? 'font-bold text-gray-400' : ''
                }`}
              >
                {row.metric}
              </td>
              {columns.map((col) =>
                col.type === 'player' ? (
                  <td
                    key={col.player.id}
                    className={`border-l border-gray-600 ${padding} text-center ${
                      row.highlight ? 'font-bold text-gray-400' : 'text-gray-300'
                    }`}
                  >
                    {row.getValue(col.player.id)}
                  </td>
                ) : (
                  <td
                    key={col.teamId}
                    className={`border-l-2 border-gray-500 ${padding} text-center font-medium text-gray-400`}
                  >
                    {row.metric !== 'Total RPR' ? (col.teamId === 'team1' ? row.getTeam1() : row.getTeam2()) : ''}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
