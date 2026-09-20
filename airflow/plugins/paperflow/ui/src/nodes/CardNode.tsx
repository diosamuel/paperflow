import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'

export type CardNodeData = {
  label: string
}

export type CardNodeType = Node<CardNodeData, 'card'>

export function CardNode({ data }: NodeProps<CardNodeType>) {
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
