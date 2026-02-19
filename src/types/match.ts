/** Match setup and rotation state types */

export type ServingStyle = 'traditional' | 'equal'

export interface Player {
  id: string // 'A' | 'B' | 'C' | 'D'
  name: string
  teamId: 'team1' | 'team2'
}

export interface Team {
  id: 'team1' | 'team2'
  name: string
  color: string
  players: [Player, Player]
}

export interface MatchSetup {
  team1: Team
  team2: Team
  servingStyle: ServingStyle
  targetScore: number
  firstServerId: string
  firstReceiverId: string
}

/** Physical state of the game at a specific moment (after a clip's outcome) */
export interface RoundnetState {
  clipId: string
  team1Score: number
  team2Score: number
  servingTeamId: 'team1' | 'team2'
  serverPlayerId: string
  receiverPlayerId: string
  serverPosition: 'left' | 'right'
  receiverPosition: 'left' | 'right'
  currentServeCount: number
  rotationIndex: number
}
