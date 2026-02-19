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
  const receivingTeamId = getOtherTeam(servingTeamId)

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

/** Build Equal serving rotation order: firstServer (right), partner (left), oppRight, oppLeft */
function getRotationOrder(setup: MatchSetup): string[] {
  const serverId = setup.firstServerId
  const receiverId = setup.firstReceiverId
  const serverPartner = getPartner(setup, serverId)
  const receiverPartner = getPartner(setup, receiverId)
  return [serverId, receiverPartner, serverPartner, receiverId]
}

/** Advance to next server in Equal mode: A->C->B->D->A */
function nextInRotation(order: string[], currentIndex: number): number {
  return (currentIndex + 1) % 4
}

/**
 * Equal serving: receiver depends on server index and first vs second serve.
 * Order [A, C, B, D] => A→D, C→B then C→A, B→D then B→C, D→A then D→B, A→C then repeat.
 * First serve: only index 0 (first server) uses +3; indices 1,2,3 use +1. Second serve: +3.
 */
function getEqualReceiverIndex(serverIdx: number, isFirstServe: boolean): number {
  if (isFirstServe) {
    return serverIdx === 0 ? 3 : (serverIdx + 1) % 4
  }
  return (serverIdx + 3) % 4
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

function isBreak(statType: StatType): boolean {
  return statType === 'ace' || statType === 'service_break' || statType === 'def_break'
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

  const rotationOrder = getRotationOrder(setup)
  const isTiebreak = () => state.team1Score === 20 && state.team2Score === 20
  let firstServeDone = false

  for (let i = 0; i < keptClips.length; i++) {
    const clip = keptClips[i]
    const clipId = String(clip.id ?? i + 1)
    const statType: StatType = clip.statType ?? 'none'

    // Store state BEFORE this clip (score, server, receiver at start of this point)
    result.set(clipId, { ...state, clipId })

    const servingTeamId = state.servingTeamId
    const receivingTeamId = getOtherTeam(servingTeamId)
    const pointWinner = getPointWinner(statType, clip.involvedPlayers, servingTeamId, receivingTeamId, setup)
    const possessionChange = isPossessionChange(statType, clip.involvedPlayers, servingTeamId, setup)
    const isBreakEvent = isBreak(statType)

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
      const atTiebreak = isTiebreak()
      if (atTiebreak) {
        if (possessionChange || pointWinner) {
          const nextIdx = nextInRotation(rotationOrder, state.rotationIndex)
          const nextServerId = rotationOrder[nextIdx]
          const nextServerTeam = getTeam(setup, nextServerId)
          const nextReceiverId = rotationOrder[getEqualReceiverIndex(nextIdx, true)]
          state = {
            ...state,
            clipId,
            team1Score: nextTeam1Score,
            team2Score: nextTeam2Score,
            servingTeamId: nextServerTeam,
            serverPlayerId: nextServerId,
            receiverPlayerId: nextReceiverId,
            rotationIndex: nextIdx,
            currentServeCount: 0,
          }
        } else {
          state = { ...state, clipId, team1Score: nextTeam1Score, team2Score: nextTeam2Score }
        }
      } else {
        const isFirstServeOfMatch = !firstServeDone && state.rotationIndex === 0
        const servesDone = (isFirstServeOfMatch ? 0 : state.currentServeCount) + 1
        const maxServes = isFirstServeOfMatch ? 1 : 2

        if (pointWinner !== null || possessionChange) {
          if (servesDone >= maxServes) {
            firstServeDone = true
            const nextIdx = nextInRotation(rotationOrder, state.rotationIndex)
            const nextServerId = rotationOrder[nextIdx]
            const nextServerTeam = getTeam(setup, nextServerId)
            const nextReceiverId = rotationOrder[getEqualReceiverIndex(nextIdx, true)]
            const nextServerPosition = nextIdx === 0 ? 'right' : nextIdx === 1 ? 'left' : nextIdx === 2 ? 'left' : 'right'
            const nextReceiverPosition = nextServerPosition === 'right' ? 'left' : 'right'

            state = {
              ...state,
              clipId,
              team1Score: nextTeam1Score,
              team2Score: nextTeam2Score,
              servingTeamId: nextServerTeam,
              serverPlayerId: nextServerId,
              receiverPlayerId: nextReceiverId,
              serverPosition: nextServerPosition,
              receiverPosition: nextReceiverPosition,
              rotationIndex: nextIdx,
              currentServeCount: 0,
            }
          } else if (!atTiebreak && !isFirstServeOfMatch) {
            const nextReceiverId = rotationOrder[getEqualReceiverIndex(state.rotationIndex, false)]
            state = {
              ...state,
              clipId,
              team1Score: nextTeam1Score,
              team2Score: nextTeam2Score,
              currentServeCount: servesDone,
              serverPosition: state.serverPosition === 'right' ? 'left' : 'right',
              receiverPlayerId: nextReceiverId,
              receiverPosition: state.receiverPosition === 'right' ? 'left' : 'right',
            }
          } else {
            state = { ...state, clipId, team1Score: nextTeam1Score, team2Score: nextTeam2Score }
          }
        } else {
          state = { ...state, clipId, team1Score: nextTeam1Score, team2Score: nextTeam2Score }
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
