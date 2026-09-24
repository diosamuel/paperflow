import { useContext, useState } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'

import { TaskActionsContext } from './taskActions'

export type TaskNodeData = {
  label: string
  blockName?: string
}

export type TaskNodeType = Node<TaskNodeData, 'task'>

export function TaskNode({ id, data, selected }: NodeProps<TaskNodeType>) {
  const actions = useContext(TaskActionsContext)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.label)

  const commit = () => {
    const label = draft.trim()
    setEditing(false)
    if (label && label !== data.label) actions?.renameTask(id, label)
  }

  return (
    <div
      onDoubleClick={(event) => {
        event.stopPropagation()
        setDraft(data.label)
        setEditing(true)
      }}
      className={`rounded-lg border bg-green-200 px-4 py-2 text-sm font-medium text-green-950 shadow-lg ${
        selected
          ? 'border-2 border-blue-500'
          : 'border border-green-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="h-4! w-4! bg-primary!"
      />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') setEditing(false)
          }}
          className="nodrag w-28 rounded border border-primary bg-white px-1 text-sm font-medium text-gray-900 outline-none"
        />
      ) : (
        data.label
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="h-4! w-4! bg-primary!"
      />
    </div>
  )
}
