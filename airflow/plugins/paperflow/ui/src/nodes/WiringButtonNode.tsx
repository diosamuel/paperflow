import { useCallback, useContext, useRef, useState } from 'react'
import type { Node, NodeProps } from '@xyflow/react'

import { WiringActionsContext } from './wiringActions'

export type WiringButtonData = {
  size: number
  color: string
}

export type WiringButtonNodeType = Node<WiringButtonData, 'wiringButton'>

export function WiringButtonNode({ data }: NodeProps<WiringButtonNodeType>) {
  const actions = useContext(WiringActionsContext)
  const [pressed, setPressed] = useState(false)
  const sentRef = useRef(false)

  const press = useCallback(
    (next: boolean) => {
      setPressed(next)
      if (sentRef.current === next) return
      sentRef.current = next
      actions?.pressButton(next)
    },
    [actions],
  )

  return (
    <button
      type="button"
      aria-label="Press the breadboard button"
      className="nodrag cursor-pointer border-0 p-0"
      style={{
        width: data.size,
        height: data.size,
        borderRadius: '50%',
        background: data.color,
        touchAction: 'none',
        transform: pressed ? 'translateY(1.5px) scale(0.88)' : 'none',
        boxShadow: pressed
          ? 'inset 0 3px 6px rgba(0, 0, 0, 0.5)'
          : '0 3px 5px rgba(0, 0, 0, 0.3)',
        transition: 'transform 90ms ease, box-shadow 90ms ease',
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        press(true)
      }}
      onPointerUp={() => press(false)}
      onPointerCancel={() => press(false)}
    />
  )
}
