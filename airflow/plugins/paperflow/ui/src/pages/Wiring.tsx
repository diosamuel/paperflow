import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Background,
  BackgroundVariant,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { WiringBoxNode } from '../nodes/WiringBoxNode'
import { WiringButtonNode } from '../nodes/WiringButtonNode'
import { WiringImageNode, type WiringPin } from '../nodes/WiringImageNode'
import {
  WiringActionsContext,
  WiringLedContext,
} from '../nodes/wiringActions'

const API_BASE: string =
  import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

const MAX_LOG_ENTRIES = 200

const RASPBERRY_X = 701
const RASPBERRY_Y = 188
const RASPBERRY_WIDTH = 358
const RASPBERRY_HEIGHT = 295

const BREADBOARD_X = 198
const BREADBOARD_Y = 264
const BREADBOARD_WIDTH = 449.02
const BREADBOARD_HEIGHT = 156

// Red hotspot rectangles, copied verbatim from the design reference
// (airflow/position.svg). Pi header row first, then the breadboard columns.
const RED_BOXES = [
  { x: 734.288, y: 237.934, width: 11.6867, height: 12.7491 },
  { x: 754.478, y: 228.726, width: 11.6867, height: 9.56182 },
  { x: 783.163, y: 237.934, width: 9.91597, height: 12.7491 },
  { x: 793.429, y: 237.934, width: 9.20768, height: 12.7491 },
  { x: 802.64, y: 237.934, width: 11.6867, height: 12.7491 },
  { x: 870.986, y: 237.58, width: 11.6867, height: 12.7491 },
  { x: 900.736, y: 237.58, width: 11.6867, height: 12.7491 },
  { x: 919.505, y: 237.58, width: 11.6867, height: 12.7491 },
  { x: 568.7, y: 318.7, width: 7.6, height: 7.6 },
  { x: 582.7, y: 318.7, width: 7.6, height: 7.6 },
  { x: 611.7, y: 278.7, width: 7.6, height: 7.6 },
  { x: 619.7, y: 278.7, width: 7.6, height: 7.6 },
  { x: 570.7, y: 390.7, width: 7.6, height: 7.6 },
  { x: 577.7, y: 390.7, width: 7.6, height: 7.6 },
  { x: 597.7, y: 390.7, width: 7.6, height: 7.6 },
  { x: 604.7, y: 390.7, width: 7.6, height: 7.6 },
  { x: 612.7, y: 390.7, width: 7.6, height: 7.6 },
  { x: 619.7, y: 390.7, width: 7.6, height: 7.6 },
  { x: 287.7, y: 320.7, width: 7.6, height: 7.6 },
  { x: 296.7, y: 320.7, width: 7.6, height: 7.6 },
  { x: 314.7, y: 320.7, width: 7.6, height: 7.6 },
  { x: 323.7, y: 320.7, width: 7.6, height: 7.6 },
  { x: 342.7, y: 320.7, width: 7.6, height: 7.6 },
  { x: 350.7, y: 320.7, width: 7.6, height: 7.6 },
]

// Wire runs, copied verbatim from the design reference (airflow/position.svg).
const WIRE_STROKE = '#6b7280'
const WIRE_OPACITY = 0.7

const SVG_WIRES = [
  { from: { x: 623.5, y: 283.5 }, to: { x: 745, y: 245 } },
  { from: { x: 616, y: 283 }, to: { x: 502, y: 202 } },
  { from: { x: 609, y: 393 }, to: { x: 345, y: 324 } },
  { from: { x: 603, y: 395 }, to: { x: 320, y: 326 } },
  { from: { x: 594, y: 395 }, to: { x: 290, y: 326 } },
  { from: { x: 616, y: 395 }, to: { x: 572, y: 320 } },
  { from: { x: 923.001, y: 241 }, to: { x: 620.042, y: 393.956 } },
  { from: { x: 354.5, y: 324 }, to: { x: 785.5, y: 245.5 } },
  { from: { x: 290.5, y: 324 }, to: { x: 797, y: 246.5 } },
  { from: { x: 326, y: 324.5 }, to: { x: 808, y: 244.5 } },
  { from: { x: 507.5, y: 199.5 }, to: { x: 877.5, y: 243 } },
  { from: { x: 588, y: 323 }, to: { x: 905.5, y: 243.5 } },
  { from: { x: 581.5, y: 393.5 }, to: { x: 512.5, y: 194 } },
]

// The push button sitting on the breadboard (the blue circle in the reference).
const BUTTON = { cx: 580.5, cy: 338.5, r: 14.5, color: '#1770d1' }

// Component illustrations from the same SVG (patterns 2-5). The three small
// ones are mirrored in the source, so those PNGs are pre-flipped.
const COMPONENTS = [
  {
    id: 'led-red',
    src: 'wiring-led-red.png',
    alt: 'Red LED',
    x: 311.686,
    y: 291,
    width: 20.9,
    height: 38,
    led: 'red',
  },
  {
    id: 'led-green',
    src: 'wiring-led-green.png',
    alt: 'Green LED',
    x: 340.0007,
    y: 290,
    width: 23.3453,
    height: 38,
    led: 'green',
  },
  {
    id: 'led-yellow',
    src: 'wiring-led-yellow.png',
    alt: 'Yellow LED',
    x: 285.0002,
    y: 290,
    width: 21.5858,
    height: 38,
    led: 'yellow',
  },
  {
    id: 'sensor',
    src: 'wiring-sensor.png',
    alt: 'DHT11 sensor',
    x: 405,
    y: 109,
    width: 114,
    height: 114,
  },
]

type Point = { x: number; y: number }

const OWNER_BOXES = [
  {
    id: 'breadboard',
    x: BREADBOARD_X,
    y: BREADBOARD_Y,
    width: BREADBOARD_WIDTH,
    height: BREADBOARD_HEIGHT,
  },
  {
    id: 'raspberry',
    x: RASPBERRY_X,
    y: RASPBERRY_Y,
    width: RASPBERRY_WIDTH,
    height: RASPBERRY_HEIGHT,
  },
  ...COMPONENTS.map((component) => ({
    id: component.id,
    x: component.x,
    y: component.y,
    width: component.width,
    height: component.height,
  })),
]

function boxFor(owner: string) {
  return OWNER_BOXES.find((box) => box.id === owner) ?? OWNER_BOXES[0]
}

// Every wire endpoint hangs off the image node its point sits in; anything
// outside them all falls back to the nearest one.
function ownerOf(point: Point): string {
  const containing = OWNER_BOXES.find(
    (box) =>
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height,
  )
  if (containing) return containing.id

  let nearest = OWNER_BOXES[0]
  let best = Number.POSITIVE_INFINITY

  for (const box of OWNER_BOXES) {
    const distance = Math.hypot(
      point.x - (box.x + box.width / 2),
      point.y - (box.y + box.height / 2),
    )
    if (distance < best) {
      best = distance
      nearest = box
    }
  }

  return nearest.id
}

function pin(
  id: string,
  type: WiringPin['type'],
  position: Position,
  point: Point,
  origin: Point,
): WiringPin {
  return {
    id,
    type,
    position,
    left: point.x - origin.x,
    top: point.y - origin.y,
  }
}

const RED_BOX_CENTERS = RED_BOXES.map((box) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
}))

const SNAP_DISTANCE = 15

function snapToNearestBox(point: Point): Point {
  let nearest = RED_BOX_CENTERS[0]
  let best = Number.POSITIVE_INFINITY

  for (const center of RED_BOX_CENTERS) {
    const distance = Math.hypot(point.x - center.x, point.y - center.y)
    if (distance < best) {
      best = distance
      nearest = center
    }
  }

  return best <= SNAP_DISTANCE ? nearest : point
}

// Ends drawn on a contact block move to that block's centre; ends that belong to
// a component (the sensor) keep the position drawn in the reference.
const WIRES = SVG_WIRES.map((wire) => ({
  from: snapToNearestBox(wire.from),
  to: snapToNearestBox(wire.to),
}))

const wireHandleId = (index: number, role: 'from' | 'to') => `wire-${index}-${role}`

const wiringEdges: Edge[] = WIRES.map((wire, index) => ({
  id: `wire-${index}`,
  source: ownerOf(wire.from),
  sourceHandle: wireHandleId(index, 'from'),
  target: ownerOf(wire.to),
  targetHandle: wireHandleId(index, 'to'),
  type: 'default',
  animated: true,
  style: { stroke: WIRE_STROKE, strokeWidth: 1.5, opacity: WIRE_OPACITY },
}))

function wirePins(owner: string): WiringPin[] {
  const box = boxFor(owner)

  return WIRES.flatMap((wire, index) =>
    (['from', 'to'] as const)
      .filter((role) => ownerOf(wire[role]) === owner)
      .map((role) => {
        const point = wire[role]
        const other = role === 'from' ? wire.to : wire.from

        // Face the other end so the bezier leaves and arrives horizontally.
        return pin(
          wireHandleId(index, role),
          role === 'from' ? 'source' : 'target',
          other.x >= point.x ? Position.Right : Position.Left,
          point,
          box,
        )
      }),
  )
}

const wiringNodes: Node[] = [
  {
    id: 'breadboard',
    type: 'wiringImage',
    position: { x: BREADBOARD_X, y: BREADBOARD_Y },
    data: {
      src: 'breadboard.png',
      alt: 'Breadboard',
      width: BREADBOARD_WIDTH,
      height: BREADBOARD_HEIGHT,
      pins: wirePins('breadboard'),
    },
    draggable: false,
    selectable: false,
  },
  {
    id: 'raspberry',
    type: 'wiringImage',
    position: { x: RASPBERRY_X, y: RASPBERRY_Y },
    data: {
      src: 'raspberry.png',
      alt: 'Raspberry Pi',
      width: RASPBERRY_WIDTH,
      height: RASPBERRY_HEIGHT,
      pins: wirePins('raspberry'),
    },
    draggable: false,
    selectable: false,
  },
  ...COMPONENTS.map((component) => ({
    id: component.id,
    type: 'wiringImage',
    position: { x: component.x, y: component.y },
    data: {
      src: component.src,
      alt: component.alt,
      width: component.width,
      height: component.height,
      pins: wirePins(component.id),
      led: component.led,
    },
    draggable: false,
    selectable: false,
  })),
  ...RED_BOXES.map((box, index) => ({
    id: `contact-${index}`,
    type: 'wiringBox',
    position: { x: box.x, y: box.y },
    data: { width: box.width, height: box.height },
    draggable: false,
    selectable: false,
  })),
  {
    id: 'button',
    type: 'wiringButton',
    position: { x: BUTTON.cx - BUTTON.r, y: BUTTON.cy - BUTTON.r },
    data: { size: BUTTON.r * 2, color: BUTTON.color },
    draggable: false,
    selectable: false,
  },
]

const nodeTypes = {
  wiringImage: WiringImageNode,
  wiringBox: WiringBoxNode,
  wiringButton: WiringButtonNode,
}

type Snapshot = {
  connected: boolean
  online: boolean
  age_seconds: number | null
  data: Record<string, unknown>
}

type LedState = Record<string, boolean>

type StreamEvent =
  | { type: 'snapshot'; sensor: Snapshot; buttons: Snapshot; leds: LedState }
  | { type: 'leds'; data: LedState }
  | {
      type: 'message'
      topic: string
      received_at: number
      data: Record<string, unknown>
    }

type LogEntry = {
  id: number
  time: string
  label: string
  detail: string
  tone: 'message' | 'info'
}

function formatData(data: Record<string, unknown>): string {
  const parts = Object.entries(data).map(([key, value]) => `${key}=${value}`)
  return parts.length > 0 ? parts.join('  ') : '—'
}

export default function Wiring() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>(
    'connecting',
  )
  const [leds, setLeds] = useState<LedState>({})
  const logRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef(0)

  const pressButton = useCallback((pressed: boolean) => {
    void fetch(`${API_BASE}/iot/button`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pressed }),
    }).catch(() => {
      // the API log already shows connectivity; nothing useful to surface here
    })
  }, [])

  const actions = useMemo(() => ({ pressButton }), [pressButton])

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/iot/stream`)

    const push = (entry: Omit<LogEntry, 'id' | 'time'>) => {
      counterRef.current += 1
      setEntries((prev) =>
        [
          ...prev,
          {
            id: counterRef.current,
            time: new Date().toLocaleTimeString(),
            ...entry,
          },
        ].slice(-MAX_LOG_ENTRIES),
      )
    }

    source.onopen = () => setStatus('live')
    source.onerror = () => setStatus('offline')

    source.onmessage = (event) => {
      let payload: StreamEvent
      try {
        payload = JSON.parse(event.data)
      } catch {
        return
      }

      if (payload.type === 'snapshot') {
        setLeds(payload.leds ?? {})

        const current = formatData(payload.sensor.data)
        push({
          tone: 'info',
          label: 'connected',
          detail:
            current === '—' ? 'waiting for Raspberry Pi data' : `current  ${current}`,
        })
        return
      }

      if (payload.type === 'leds') {
        setLeds(payload.data)
        return
      }

      push({
        tone: 'message',
        label: payload.topic.replace('paperflow/', ''),
        detail: formatData(payload.data),
      })
    }

    return () => source.close()
  }, [])

  useEffect(() => {
    const container = logRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [entries])

  const statusLabel =
    status === 'live' ? 'live' : status === 'connecting' ? 'connecting' : 'offline'
  const statusDot =
    status === 'live'
      ? 'bg-green-500'
      : status === 'connecting'
        ? 'bg-amber-500'
        : 'bg-red-500'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100 dark:bg-gray-950">
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="fixed top-4 left-4 z-10 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-lg transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Back to Builder
        </button>

        <WiringLedContext.Provider value={leds}>
          <WiringActionsContext.Provider value={actions}>
            <ReactFlow
              nodes={wiringNodes}
              edges={wiringEdges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              nodesFocusable={false}
              edgesFocusable={false}
              className="wiring-canvas bg-gray-50 dark:bg-gray-900"
            >
              <Background variant={BackgroundVariant.Dots} gap={20} />
            </ReactFlow>
          </WiringActionsContext.Provider>
        </WiringLedContext.Provider>
      </div>

      <aside className="flex w-80 shrink-0 flex-col border-l border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-300 px-3 py-2 dark:border-gray-700">
          <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            API log
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            <span className={`h-2 w-2 rounded-full ${statusDot}`} />
            {statusLabel}
          </span>
        </div>

        <div
          ref={logRef}
          className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
        >
          {entries.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500">
              Waiting for events from {API_BASE}…
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="border-b border-gray-100 py-1 last:border-0 dark:border-gray-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      entry.tone === 'message'
                        ? 'font-semibold text-primary'
                        : 'font-semibold text-gray-500 dark:text-gray-400'
                    }
                  >
                    {entry.label}
                  </span>
                  <span className="shrink-0 text-gray-400 dark:text-gray-500">
                    {entry.time}
                  </span>
                </div>
                <div className="break-words text-gray-700 dark:text-gray-300">
                  {entry.detail}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-300 px-3 py-2 dark:border-gray-700">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {entries.length} event{entries.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setEntries([])}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Clear
          </button>
        </div>
      </aside>
    </div>
  )
}
