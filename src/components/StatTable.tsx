import type { MatchStats } from '../core/stats'
import type { Player } from '../types/match'

interface StatTableProps {
  stats: MatchStats
  players: Player[]
}

export function StatTable({ stats, players }: StatTableProps) {
  const getPlayerStats = (playerId: string) => stats.players[playerId]

  const rows: { metric: string; getValue: (playerId: string) => string; highlight?: boolean }[] = [
    {
      metric: 'Breaks : Broken',
      getValue: (playerId) => {
        const p = getPlayerStats(playerId)
        return p ? `${p.breaks} : ${p.broken}` : '-'
      },
    },
    {
      metric: 'Aces : Aced',
      getValue: (playerId) => {
        const p = getPlayerStats(playerId)
        return p ? `${p.aces} : ${p.acedCount}` : '-'
      },
    },
    {
      metric: 'Serve %',
      getValue: (playerId) => {
        const p = getPlayerStats(playerId)
        if (!p || p.totalServes === 0) return '-'
        const pct = Math.round((p.servesOn / p.totalServes) * 100)
        return `${pct}% (${p.servesOn}/${p.totalServes})`
      },
    },
    {
      metric: 'Holds : Receives',
      getValue: (playerId) => {
        const p = getPlayerStats(playerId)
        return p ? `${p.holds} : ${p.receives}` : '-'
      },
    },
    {
      metric: 'Errors',
      getValue: (playerId) => {
        const p = getPlayerStats(playerId)
        return p ? String(p.errors) : '-'
      },
    },
    {
      metric: 'Defensive Touches',
      getValue: (playerId) => {
        const p = getPlayerStats(playerId)
        return p ? String(p.defTouchesReturned + p.defTouchesNotReturned) : '-'
      },
    },
    {
      metric: 'Total RPR',
      getValue: (playerId) => {
        const p = getPlayerStats(playerId)
        return p ? String(p.rpr.total) : '-'
      },
      highlight: true,
    },
  ]

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-700 bg-rc-dark">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="px-4 py-2 text-left font-medium text-gray-400">Metric</th>
            {players.map((p) => (
              <th
                key={p.id}
                className="border-l border-gray-700 px-4 py-2 text-center font-medium text-gray-300"
              >
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.metric}
              className={`border-b border-gray-700 last:border-b-0 ${
                row.highlight ? 'bg-rc-surface' : ''
              }`}
            >
              <td
                className={`px-4 py-2 text-gray-300 ${
                  row.highlight ? 'font-bold text-rc-accent text-base' : ''
                }`}
              >
                {row.metric}
              </td>
              {players.map((p) => (
                <td
                  key={p.id}
                  className={`border-l border-gray-700 px-4 py-2 text-center ${
                    row.highlight ? 'font-bold text-rc-accent text-base' : 'text-gray-300'
                  }`}
                >
                  {row.getValue(p.id)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
