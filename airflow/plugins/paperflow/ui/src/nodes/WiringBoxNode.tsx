import type { Node, NodeProps } from '@xyflow/react'

export type WiringBoxData = {
  width: number
  height: number
}

export type WiringBoxNodeType = Node<WiringBoxData, 'wiringBox'>

export function WiringBoxNode({ data }: NodeProps<WiringBoxNodeType>) {
  return (
    <div
      style={{ width: data.width, height: data.height }}
      className="border border-red-500 bg-red-500/20"
    />
  )
}
