import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { calculateMatchFlow } from '../core/rotation'
import type { MatchSetup, RoundnetState } from '../types/match'

interface ClipLike {
  id?: number
  statType?: string
  involvedPlayers?: string[]
  status?: 'pending' | 'done' | 'trash'
  keep?: boolean
}

interface MatchContextValue {
  matchSetup: MatchSetup | null
  setMatchSetup: (setup: MatchSetup | null) => void
  matchFlow: Map<string, RoundnetState>
  getClipState: (clipId: string) => RoundnetState | undefined
  getLastState: () => RoundnetState | null
}

const MatchContext = createContext<MatchContextValue | null>(null)

export function MatchProvider({
  children,
  matchSetup,
  setMatchSetup,
  clips,
}: {
  children: ReactNode
  matchSetup: MatchSetup | null
  setMatchSetup: (setup: MatchSetup | null) => void
  clips: ClipLike[]
}) {
  const matchFlow = useMemo(() => {
    if (!matchSetup) return new Map<string, RoundnetState>()
    return calculateMatchFlow(matchSetup, clips)
  }, [matchSetup, clips])

  const getClipState = useCallback(
    (clipId: string): RoundnetState | undefined => {
      return matchFlow.get(clipId)
    },
    [matchFlow]
  )

  const getLastState = useCallback((): RoundnetState | null => {
    if (matchFlow.size === 0) return null
    const entries = Array.from(matchFlow.entries())
    return entries[entries.length - 1]?.[1] ?? null
  }, [matchFlow])

  const value: MatchContextValue = useMemo(
    () => ({
      matchSetup,
      setMatchSetup,
      matchFlow,
      getClipState,
      getLastState,
    }),
    [matchSetup, matchFlow, getClipState, getLastState]
  )

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>
}

export function useMatchContext(): MatchContextValue {
  const ctx = useContext(MatchContext)
  if (!ctx) {
    throw new Error('useMatchContext must be used within MatchProvider')
  }
  return ctx
}
