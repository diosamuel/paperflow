import { createContext } from 'react'

export type TaskActions = {
  renameTask: (nodeId: string, label: string) => void
}

export const TaskActionsContext = createContext<TaskActions | null>(null)
