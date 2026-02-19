/**
 * Stats engine: calculates player statistics and RPR scores from
 * match setup, clips, and computed match flow.
 */

import type { MatchSetup, RoundnetState } from '../types/match'

type StatType =
  | 'ace'
  | 'double_fault'
  | 'service_break'
  | 'sideout'
  | 'def_break'
  | 'def_hold'
  | 'error'
  | 'none'

interface ClipLike {
  id?: number
  statType?: StatType
  involvedPlayers?: string[]
  status?: 'pending' | 'done' | 'trash'
  keep?: boolean
}

function getTeam(setup: MatchSetup, playerId: string): 'team1' | 'team2' {
  return setup.team1.players.some((p) => p.id === playerId) ? 'team1' : 'team2'
}

function getOtherTeam(teamId: 'team1' | 'team2'): 'team1' | 'team2' {
  return teamId === 'team1' ? 'team2' : 'team1'
}

function getReceivingTeamPlayerIds(setup: MatchSetup, receivingTeamId: 'team1' | 'team2'): string[] {
  const team = setup[receivingTeamId]
  return team.players.map((p) => p.id)
}

function getServingTeamPlayerIds(setup: MatchSetup, servingTeamId: 'team1' | 'team2'): string[] {
  const team = setup[servingTeamId]
  return team.players.map((p) => p.id)
}

function createEmptyPlayerStats(playerId: string): PlayerStats {
  return {
    playerId,
    aces: 0,
    doubleFaults: 0,
    errors: 0,
    acedCount: 0,
    totalServes: 0,
    servesOn: 0,
    breaks: 0,
    totalHits: 0,
    successfulHits: 0,
    defTouchesReturned: 0,
    defTouchesNotReturned: 0,
    holds: 0,
    receives: 0,
    serveWins: 0,
    broken: 0,
    rpr: {
      serving: 0,
      hitting: 0,
      defense: 0,
      efficiency: 0,
      total: 0,
    },
  }
}

export interface PlayerStats {
  playerId: string
  aces: number
  doubleFaults: number
  errors: number
  acedCount: number
  totalServes: number
  servesOn: number
  breaks: number
  totalHits: number
  successfulHits: number
  defTouchesReturned: number
  defTouchesNotReturned: number
  /** Points won while receiving (receive hold) */
  holds: number
  /** Total receive opportunities (only when this player is the designated receiver) */
  receives: number
  /** Points won while serving (break) */
  serveWins: number
  /** Points lost while receiving (got broken) */
  broken: number
  rpr: {
    serving: number
    hitting: number
    defense: number
    efficiency: number
    total: number
  }
}

export interface MatchStats {
  team1: { score: number; breaks: number; holds: number }
  team2: { score: number; breaks: number; holds: number }
  players: Record<string, PlayerStats>
}

export function calculateStats(
  setup: MatchSetup,
  clips: ClipLike[],
  matchFlow: Map<string, RoundnetState>
): MatchStats {
  const playerIds = [
    setup.team1.players[0].id,
    setup.team1.players[1].id,
    setup.team2.players[0].id,
    setup.team2.players[1].id,
  ]

  const players: Record<string, PlayerStats> = {}
  for (const id of playerIds) {
    players[id] = createEmptyPlayerStats(id)
  }

  const team1 = { score: 0, breaks: 0, holds: 0 }
  const team2 = { score: 0, breaks: 0, holds: 0 }

  const keptClips = clips.filter((c) => c.status !== 'trash' && c.keep !== false)

  for (const clip of keptClips) {
    const clipId = String(clip.id ?? 0)
    const state = matchFlow.get(clipId)
    if (!state) continue

    const statType: StatType = clip.statType ?? 'none'
    const serverId = state.serverPlayerId
    const receiverId = state.receiverPlayerId
    const servingTeamId = state.servingTeamId
    const receivingTeamId = getOtherTeam(servingTeamId)
    const involvedPlayers = clip.involvedPlayers ?? []

    const server = players[serverId]
    const receiver = players[receiverId]
    if (!server || !receiver) continue

    const receivingPlayerIds = getReceivingTeamPlayerIds(setup, receivingTeamId)
    const servingPlayerIds = getServingTeamPlayerIds(setup, servingTeamId)

    // Only the designated receiver gets a receive opportunity
    

    switch (statType) {
      case 'ace':
        server.aces++
        server.breaks++
        server.totalServes++
        server.servesOn++
        receiver.acedCount++
        receiver.broken++ 
        receiver.receives++
        break

      case 'double_fault':
        server.doubleFaults++
        server.totalServes++
        receiver.holds++
        receiver.receives++
        break

      case 'service_break':
        server.breaks++
        server.totalServes++
        server.servesOn++
        receiver.broken++
        receiver.receives++
        receiver.totalHits++
        break

      case 'sideout':
        server.totalServes++
        server.servesOn++
        receiver.holds++
        receiver.receives++
        receiver.totalHits++
        receiver.successfulHits++
        break

      case 'def_break':
        server.totalServes++
        server.servesOn++
        receiver.broken++
        receiver.receives++
        receiver.totalHits++
        for (let i = 0; i < involvedPlayers.length; i++) {
          const p = players[involvedPlayers[i]]
          if (p) {
            if (i === involvedPlayers.length - 1) {
              p.defTouchesReturned++
              p.breaks++
            } else {
              p.defTouchesNotReturned++
            }
          }
        }
        break

      case 'def_hold':
        server.totalServes++
        server.servesOn++
        receiver.holds++
        receiver.receives++
        receiver.totalHits++
        receiver.successfulHits++
        for (let i = 0; i < involvedPlayers.length; i++) {
          const p = players[involvedPlayers[i]]
          if (p) {
            if (i === involvedPlayers.length - 1) {
              p.defTouchesReturned++
            } else {
              p.defTouchesNotReturned++
            }
          }
        }
        break

      case 'error':
        server.totalServes++
        server.servesOn++
        receiver.receives++
        receiver.totalHits++
        for (const pid of involvedPlayers) {
          const p = players[pid]
          if (p) p.errors++
        }
        const errorPlayerId = involvedPlayers[0]
        if (errorPlayerId) {
          const errorTeam = getTeam(setup, errorPlayerId)
          if (errorTeam === receivingTeamId) {
            server.breaks++
            receiver.broken++
          } else {
            receiver.holds++
            receiver.successfulHits++
          }
        }
        break

      case 'none':
        break
    }
  }

  // Get final scores from match flow
  const finalState = matchFlow.get('_final') ?? Array.from(matchFlow.values()).pop()
  if (finalState) {
    team1.score = finalState.team1Score
    team2.score = finalState.team2Score
  }

  // Calculate RPR for each player
  for (const pid of playerIds) {
    const p = players[pid]
    const {
      aces,
      errors,
      acedCount,
      totalServes,
      servesOn,
      defTouchesReturned,
      defTouchesNotReturned,

      successfulHits,
      totalHits,
    } = p

    // Serving RPR: 5.5 * aces + 15 * (servesOn / totalServes)
    let servingRpr = 0
    if (totalServes > 0) {
      servingRpr = 5.5 * aces + 15 * (servesOn / totalServes)
    }

    // Efficiency RPR: 20 - 5 * errors - 2 * acedCount
    const efficiencyRpr = Math.max(0, 20 - 5 * errors - 2 * acedCount)

    // Hitting RPR: 20 * (successfulHits / totalHits)
    
    const hittingRpr = 20 * (successfulHits / totalHits)
    

    // Defense RPR: 0.4 * hittingRpr * defTouchesReturned + defTouchesNotReturned
    const defenseRpr = 0.4 * hittingRpr * defTouchesReturned + defTouchesNotReturned

    // Total RPR: 1.57 * (serving + efficiency + hitting + defense)
    p.rpr = {
      serving: Math.round(servingRpr * 100) / 100,
      hitting: Math.round(hittingRpr * 100) / 100,
      defense: Math.round(defenseRpr * 100) / 100,
      efficiency: Math.round(efficiencyRpr * 100) / 100,
      total: Math.round(1.57 * (servingRpr + efficiencyRpr + hittingRpr + defenseRpr) * 100) / 100,
    }
  }

  return {
    team1,
    team2,
    players,
  }
}
