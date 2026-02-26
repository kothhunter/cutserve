/**
 * Pure rotation engine: calculates match flow from MatchSetup + clips.
 * Iterates through kept clips, applies stat outcomes, updates score and rotation.
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

function getPartner(setup: MatchSetup, playerId: string): string {
  for (const team of [setup.team1, setup.team2]) {
    const ids = team.players.map((p) => p.id)
    if (ids.includes(playerId)) {
      return ids.find((id) => id !== playerId)!
    }
  }
  throw new Error(`Player ${playerId} not found`)
}

function getTeam(setup: MatchSetup, playerId: string): 'team1' | 'team2' {
  return setup.team1.players.some((p) => p.id === playerId) ? 'team1' : 'team2'
}

function getOtherTeam(teamId: 'team1' | 'team2'): 'team1' | 'team2' {
  return teamId === 'team1' ? 'team2' : 'team1'
}

function buildInitialState(setup: MatchSetup, firstClipId: string): RoundnetState {
  const serverId = setup.firstServerId
  const receiverId = setup.firstReceiverId
  const servingTeamId = getTeam(setup, serverId)

  return {
    clipId: firstClipId,
    team1Score: 0,
    team2Score: 0,
    servingTeamId,
    serverPlayerId: serverId,
    receiverPlayerId: receiverId,
    serverPosition: 'right',
    receiverPosition: 'right',
    currentServeCount: 0,
    rotationIndex: 0,
  }
}

function isPossessionChange(statType: StatType, involvedPlayers: string[] | undefined, servingTeamId: 'team1' | 'team2', setup: MatchSetup): boolean {
  switch (statType) {
    case 'double_fault':
    case 'sideout':
    case 'def_hold':
      return true
    case 'error':
      if (!involvedPlayers || involvedPlayers.length === 0) return false
      const errorTeam = getTeam(setup, involvedPlayers[0])
      return errorTeam === servingTeamId
    default:
      return false
  }
}

/**
 * Equal serving overtime is active when BOTH teams have reached the target score
 * and the game is not yet decided by a 2‑point lead.
 */
function isEqualOvertime(targetScore: number, team1Score: number, team2Score: number): boolean {
  if (!targetScore || targetScore <= 0) return false
  if (team1Score < targetScore || team2Score < targetScore) return false
  return Math.abs(team1Score - team2Score) < 2
}

function getPointWinner(
  statType: StatType,
  involvedPlayers: string[] | undefined,
  servingTeamId: 'team1' | 'team2',
  receivingTeamId: 'team1' | 'team2',
  setup: MatchSetup
): 'team1' | 'team2' | null {
  switch (statType) {
    case 'ace':
    case 'service_break':
    case 'def_break':
      return servingTeamId
    case 'double_fault':
    case 'sideout':
    case 'def_hold':
      return receivingTeamId
    case 'error':
      if (!involvedPlayers || involvedPlayers.length === 0) return null
      const errorTeam = getTeam(setup, involvedPlayers[0])
      return errorTeam === servingTeamId ? receivingTeamId : servingTeamId
    case 'none':
      return null
    default:
      return null
  }
}

export function calculateMatchFlow(
  setup: MatchSetup,
  clips: ClipLike[]
): Map<string, RoundnetState> {
  const keptClips = clips.filter((c) => c.status !== 'trash' && c.keep !== false)
  const result = new Map<string, RoundnetState>()

  if (keptClips.length === 0) return result

  const firstClip = keptClips[0]
  const firstClipId = String(firstClip.id ?? 0)
  let state = buildInitialState(setup, firstClipId)

  // Precompute Equal serving cycles when using Equal style
  const useEqual = setup.servingStyle === 'equal'
  type Pair = { serverId: string; receiverId: string }
  let equalBaseCycle: Pair[] = []
  let equalOvertimeCycle: Pair[] = []
  let equalCycleIndex = 0

  if (useEqual) {
    const A = setup.firstServerId
    const D = setup.firstReceiverId
    const C = getPartner(setup, D)
    const B = getPartner(setup, A)

    // Regular Equal cycle (8 serves): A-D, C-B, C-A, B-D, B-C, D-A, D-B, A-C
    equalBaseCycle = [
      { serverId: A, receiverId: D },
      { serverId: C, receiverId: B },
      { serverId: C, receiverId: A },
      { serverId: B, receiverId: D },
      { serverId: B, receiverId: C },
      { serverId: D, receiverId: A },
      { serverId: D, receiverId: B },
      { serverId: A, receiverId: C },
    ]

    // Overtime cycle (4 serves): A-D, D-A, B-C, C-B
    equalOvertimeCycle = [
      { serverId: A, receiverId: D },
      { serverId: D, receiverId: A },
      { serverId: B, receiverId: C },
      { serverId: C, receiverId: B },
    ]

    // Ensure initial state matches the first pair of the Equal cycle
    state.servingTeamId = getTeam(setup, A)
    state.serverPlayerId = A
    state.receiverPlayerId = D
    state.serverPosition = 'right'
    state.receiverPosition = 'left'
    state.rotationIndex = equalCycleIndex
    state.currentServeCount = 0
  }

  for (let i = 0; i < keptClips.length; i++) {
    const clip = keptClips[i]
    const clipId = String(clip.id ?? i + 1)
    const statType: StatType = clip.statType ?? 'none'

    // Store state BEFORE this clip (score, server, receiver at start of this point)
    result.set(clipId, { ...state, clipId })

    const servingTeamId = state.servingTeamId
    const receivingTeamId = getOtherTeam(servingTeamId)
    const pointWinner = getPointWinner(statType, clip.involvedPlayers, servingTeamId, receivingTeamId, setup)

    // Update score first
    let nextTeam1Score = state.team1Score
    let nextTeam2Score = state.team2Score
    if (pointWinner === 'team1') nextTeam1Score++
    else if (pointWinner === 'team2') nextTeam2Score++

    if (setup.servingStyle === 'traditional') {
      let nextServingTeamId = state.servingTeamId

      // 1. Handle possession change (sideout): receiving team won → they become serving team
      if (pointWinner && pointWinner !== state.servingTeamId) {
        nextServingTeamId = pointWinner
      }

      // 2. Determine server based on score (even/odd)
      const servingTeamScore = nextServingTeamId === 'team1' ? nextTeam1Score : nextTeam2Score
      const isEven = servingTeamScore % 2 === 0

      const servingTeam = nextServingTeamId === 'team1' ? setup.team1 : setup.team2
      const receivingTeam = nextServingTeamId === 'team1' ? setup.team2 : setup.team1

      let nextServerPosition = state.serverPosition
      let nextServerId = state.serverPlayerId
      let nextReceiverId = state.receiverPlayerId
      let nextReceiverPosition = state.receiverPosition

      if (pointWinner === state.servingTeamId) {
        // Break: serving team won → server swaps positions; receiver is diagonally across (same side)
        nextServerPosition = state.serverPosition === 'right' ? 'left' : 'right'
        const recvRightPlayer = state.receiverPosition === 'right' ? state.receiverPlayerId : getPartner(setup, state.receiverPlayerId)
        const recvLeftPlayer = state.receiverPosition === 'left' ? state.receiverPlayerId : getPartner(setup, state.receiverPlayerId)
        nextReceiverId = nextServerPosition === 'right' ? recvRightPlayer : recvLeftPlayer
        nextReceiverPosition = nextServerPosition
      } else if (pointWinner && pointWinner !== state.servingTeamId) {
        // Sideout: receiving team won → they become serving team. Even = right serves, odd = left
        nextServerPosition = isEven ? 'right' : 'left'
        const receiverId = state.receiverPlayerId
        const receiverPos = state.receiverPosition
        const rightPlayer = receiverPos === 'right' ? receiverId : getPartner(setup, receiverId)
        const leftPlayer = receiverPos === 'left' ? receiverId : getPartner(setup, receiverId)
        nextServerId = isEven ? rightPlayer : leftPlayer
        // Receiver is diagonally across: same side as server. Receiving team = old serving team.
        const prevServer = state.serverPlayerId
        const prevServerPos = state.serverPosition
        const recvRightPlayer = prevServerPos === 'right' ? prevServer : getPartner(setup, prevServer)
        const recvLeftPlayer = prevServerPos === 'left' ? prevServer : getPartner(setup, prevServer)
        nextReceiverId = nextServerPosition === 'right' ? recvRightPlayer : recvLeftPlayer
        nextReceiverPosition = nextServerPosition
      } else if (!pointWinner) {
        // No point (e.g. statType 'none') - no change
      }

      state = {
        ...state,
        clipId,
        team1Score: nextTeam1Score,
        team2Score: nextTeam2Score,
        servingTeamId: nextServingTeamId,
        serverPlayerId: nextServerId,
        serverPosition: nextServerPosition,
        receiverPlayerId: nextReceiverId,
        receiverPosition: nextReceiverPosition,
      }
    } else {
      // Equal serving: fixed cycles of server/receiver pairs, independent of point outcome
      const targetScore = setup.targetScore
      const inOvertime = isEqualOvertime(targetScore, nextTeam1Score, nextTeam2Score)
      const cycle = inOvertime ? equalOvertimeCycle : equalBaseCycle
      const cycleLength = cycle.length

      if (cycleLength === 0) {
        // Safety fallback: no Equal cycle defined, just carry score forward
        state = {
          ...state,
          clipId,
          team1Score: nextTeam1Score,
          team2Score: nextTeam2Score,
        }
      } else if (statType === 'none') {
        // Clips with no stat should NOT advance the Equal rotation.
        // Keep the same server/receiver, only carry score (which will be unchanged).
        state = {
          ...state,
          clipId,
          team1Score: nextTeam1Score,
          team2Score: nextTeam2Score,
        }
      } else {
        // Advance to next server/receiver pair only when a real stat is present
        equalCycleIndex = (equalCycleIndex + 1) % cycleLength
        const pair = cycle[equalCycleIndex]
        const nextServerId = pair.serverId
        const nextReceiverId = pair.receiverId
        const nextServingTeamId = getTeam(setup, nextServerId)

        state = {
          ...state,
          clipId,
          team1Score: nextTeam1Score,
          team2Score: nextTeam2Score,
          servingTeamId: nextServingTeamId,
          serverPlayerId: nextServerId,
          receiverPlayerId: nextReceiverId,
          // Positions are not used to drive Equal logic; keep a simple convention.
          serverPosition: 'right',
          receiverPosition: 'left',
          rotationIndex: equalCycleIndex,
          currentServeCount: 0,
        }
      }
    }
  }

  // Store final state (after last clip) for when no clip is selected
  if (keptClips.length > 0) {
    const lastClipId = String(keptClips[keptClips.length - 1].id ?? keptClips.length)
    result.set('_final', { ...state, clipId: lastClipId })
  }

  return result
}

/**
 * Small debug helper: generate the sequence of server/receiver pairs for Equal serving.
 * Useful for manually verifying Equal and overtime cycles.
 */
export function __debugEqualCycleOrder(setup: MatchSetup, numPoints: number): Array<{ server: string; receiver: string }> {
  const clips: ClipLike[] = []
  for (let i = 0; i < numPoints; i++) {
    clips.push({ id: i + 1, statType: 'none', status: 'done', keep: true })
  }
  const flow = calculateMatchFlow({ ...setup, servingStyle: 'equal' }, clips)
  const sequence: Array<{ server: string; receiver: string }> = []
  for (const clip of clips) {
    const id = String(clip.id ?? 0)
    const state = flow.get(id)
    if (state) {
      sequence.push({ server: state.serverPlayerId, receiver: state.receiverPlayerId })
    }
  }
  return sequence
}
