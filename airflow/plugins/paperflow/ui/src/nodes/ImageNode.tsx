import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'

export type ImageNodeData = {
  src: string
  alt?: string
  label?: string
}

export type ImageNodeType = Node<ImageNodeData, 'image'>

export function ImageNode({ data, selected }: NodeProps<ImageNodeType>) {
  return (
    <div className={`flex w-32 flex-col items-center gap-2 rounded-xl border bg-white p-3 shadow-lg dark:bg-gray-800 ${selected ? 'border-2 border-blue-500' : 'border border-gray-300 dark:border-gray-700'}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="h-4! w-4! bg-indigo-500!"
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
        position={Position.Right}
        className="h-4! w-4! bg-indigo-500!"
      />
    </div>
  )
}
