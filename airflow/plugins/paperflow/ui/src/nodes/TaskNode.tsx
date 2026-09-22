import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'

export type TaskNodeData = {
  label: string
}

export type TaskNodeType = Node<TaskNodeData, 'task'>

export function TaskNode({ data }: NodeProps<TaskNodeType>) {
  return (
    <div className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
      <Handle
        type="target"
        position={Position.Top}
        className="bg-indigo-500!"
      />
      {data.label}
      <Handle
        type="source"
        position={Position.Bottom}
        className="bg-indigo-500!"
      />
    </div>
  )
}
