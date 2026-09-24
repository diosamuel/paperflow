import { useContext } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'

import { WiringLedContext } from './wiringActions'

export type WiringPin = {
  id: string
  type: 'source' | 'target'
  position: Position
  left: number
  top: number
}

export type WiringImageData = {
  src: string
  alt: string
  width: number
  height: number
  pins: WiringPin[]
  led?: string
}

export type WiringImageNodeType = Node<WiringImageData, 'wiringImage'>

export function WiringImageNode({ data }: NodeProps<WiringImageNodeType>) {
  const leds = useContext(WiringLedContext)
  const lit = data.led ? Boolean(leds[data.led]) : true

  return (
    <div
      style={{ width: data.width, height: data.height }}
      className="relative select-none"
    >
      <img
        src={data.src}
        alt={data.alt}
        width={data.width}
        height={data.height}
        draggable={false}
        className="select-none"
        style={{ opacity: lit ? 1 : 0.5, transition: 'opacity 200ms' }}
      />
      {data.pins.map((pin) => (
        <Handle
          key={pin.id}
          id={pin.id}
          type={pin.type}
          position={pin.position}
          isConnectable={false}
          style={{
            left: pin.left,
            top: pin.top,
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            background: 'transparent',
            border: 'none',
          }}
        />
      ))}
    </div>
  )
}
