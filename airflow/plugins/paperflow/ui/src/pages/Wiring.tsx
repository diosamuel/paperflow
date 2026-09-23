import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE: string =
  import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

const MAX_LOG_ENTRIES = 200

const CANVAS_WIDTH = 1440
const CANVAS_HEIGHT = 900

const RASPBERRY_X = 701
const RASPBERRY_Y = 188
const RASPBERRY_WIDTH = 358
const RASPBERRY_HEIGHT = 295

const BREADBOARD_X = 198
const BREADBOARD_Y = 264
const BREADBOARD_WIDTH = 449.02
const BREADBOARD_HEIGHT = 156

const BOX_WIDTH = 13.1
const BOX_HEIGHT = 14.17

const BOXES = [
  { x: 733.58, y: 237.23 },
  { x: 753.77, y: 228.02 },
]

const PI_PIN1_X = 47.5
const PI_PIN_PITCH = 9.89
const PI_ODD_ROW_Y = 45
const PI_EVEN_ROW_Y = 55

function pinBox(pin: number) {
  const column = Math.ceil(pin / 2)
  const rowY = pin % 2 === 1 ? PI_ODD_ROW_Y : PI_EVEN_ROW_Y

  return {
    x:
      RASPBERRY_X +
      PI_PIN1_X +
      (column - 1) * PI_PIN_PITCH -
      BOX_WIDTH / 2,
    y: RASPBERRY_Y + rowY - BOX_HEIGHT / 2,
  }
}

const PIN_BOXES = [11, 13, 15].map(pinBox)

const WIRE_FROM = {
  x: BOXES[0].x + BOX_WIDTH / 2,
  y: BOXES[0].y + BOX_HEIGHT / 2,
}
const WIRE_TO = { x: 600, y: 330 }

const WIRE_PATH = `M ${WIRE_FROM.x} ${WIRE_FROM.y} C ${WIRE_FROM.x - 30} ${
  WIRE_FROM.y + 80
}, ${WIRE_TO.x + 60} ${WIRE_TO.y}, ${WIRE_TO.x} ${WIRE_TO.y}`

type Snapshot = {
  connected: boolean
  online: boolean
  age_seconds: number | null
  data: Record<string, unknown>
}

type StreamEvent =
  | { type: 'snapshot'; sensor: Snapshot; buttons: Snapshot }
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
  const logRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef(0)

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
        const current = formatData(payload.sensor.data)
        push({
          tone: 'info',
          label: 'connected',
          detail:
            current === '—' ? 'waiting for Raspberry Pi data' : `current  ${current}`,
        })
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
      <div className="relative min-w-0 flex-1 overflow-auto">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="fixed top-4 left-4 z-10 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-lg transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Back to Builder
        </button>

        <div
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          className="relative mx-auto my-16 shrink-0 rounded-xl border border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
        >
          <img
            src="breadboard.png"
            alt="Breadboard"
            width={BREADBOARD_WIDTH}
            height={BREADBOARD_HEIGHT}
            draggable={false}
            style={{ left: BREADBOARD_X, top: BREADBOARD_Y }}
            className="absolute select-none"
          />
          <img
            src="raspberry.png"
            alt="Raspberry Pi"
            width={RASPBERRY_WIDTH}
            height={RASPBERRY_HEIGHT}
            draggable={false}
            style={{ left: RASPBERRY_X, top: RASPBERRY_Y }}
            className="absolute select-none"
          />
          <svg
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            className="pointer-events-none absolute inset-0"
          >
            <path
              d={WIRE_PATH}
              fill="none"
              stroke="#ef4444"
              strokeWidth={3}
              strokeLinecap="round"
            />
          </svg>
          {[...BOXES, ...PIN_BOXES].map((box) => (
            <div
              key={`${box.x}-${box.y}`}
              style={{
                left: box.x,
                top: box.y,
                width: BOX_WIDTH,
                height: BOX_HEIGHT,
              }}
              className="absolute border border-red-500 bg-red-500/20"
            />
          ))}
        </div>
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
                        ? 'font-semibold text-indigo-500'
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
