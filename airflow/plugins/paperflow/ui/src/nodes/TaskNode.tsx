import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'

export type TaskNodeData = {
  label: string
}

export type TaskNodeType = Node<TaskNodeData, 'task'>

export function TaskNode({ data, selected }: NodeProps<TaskNodeType>) {
  return (
    <div className={`rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-lg dark:bg-gray-800 dark:text-gray-100 ${selected ? 'border-2 border-blue-500' : 'border border-gray-300 dark:border-gray-700'}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="h-4! w-4! bg-indigo-500!"
      />
      {data.label}
      <Handle
        type="source"
        position={Position.Right}
        className="h-4! w-4! bg-indigo-500!"
      />
    </div>
  )
}
