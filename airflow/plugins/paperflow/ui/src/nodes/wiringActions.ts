import { createContext } from 'react'

export type WiringLedState = Record<string, boolean>

export type WiringActions = {
  pressButton: (pressed: boolean) => void
}

export const WiringLedContext = createContext<WiringLedState>({})

export const WiringActionsContext = createContext<WiringActions | null>(null)
