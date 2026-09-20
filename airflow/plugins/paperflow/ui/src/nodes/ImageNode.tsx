import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'

export type ImageNodeData = {
  src: string
  alt?: string
  label?: string
}

export type ImageNodeType = Node<ImageNodeData, 'image'>

export function ImageNode({ data }: NodeProps<ImageNodeType>) {
  return (
    <div className="flex w-32 flex-col items-center gap-2 rounded-xl border border-gray-300 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <Handle
        type="target"
        position={Position.Top}
        className="bg-indigo-500!"
      />
      <img
        src={data.src}
        alt={data.alt ?? ''}
        width={96}
        height={96}
        draggable={false}
        className="select-none"
      />
      {data.label && (
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
          {data.label}
        </span>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="bg-indigo-500!"
      />
    </div>
  )
}
