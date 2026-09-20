import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import * as Blockly from 'blockly'
import 'blockly/blocks'
import { pythonGenerator } from 'blockly/python'

import { CREATE_VARIABLE_BLOCK } from '../blocks/createVariable'
import { HUMIDITY_SENSOR_BLOCK } from '../blocks/humiditySensor'

const toolbox = {
  kind: 'flyoutToolbox' as const,
  contents: [
    { kind: 'block' as const, type: HUMIDITY_SENSOR_BLOCK },
    { kind: 'block' as const, type: CREATE_VARIABLE_BLOCK },
    { kind: 'block' as const, type: 'controls_if' },
    { kind: 'block' as const, type: 'logic_compare' },
    { kind: 'block' as const, type: 'logic_operation' },
    { kind: 'block' as const, type: 'math_number' },
    { kind: 'block' as const, type: 'math_arithmetic' },
    { kind: 'block' as const, type: 'text' },
    { kind: 'block' as const, type: 'text_print' },
  ],
}

const EMPTY_CODE = '# Drag blocks to generate Python'
const MIN_CODE_WIDTH = 160
const MIN_WORKSPACE_WIDTH = 220

export function BlocklyEditor() {
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [code, setCode] = useState(EMPTY_CODE)
  const [codeWidth, setCodeWidth] = useState(() =>
    Math.max(MIN_CODE_WIDTH, Math.round(window.innerWidth * 0.3)),
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const workspace = Blockly.inject(container, {
      toolbox,
      grid: { spacing: 20, length: 3, colour: '#cbd5e1', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.9 },
      move: { scrollbars: true, drag: true, wheel: true },
    })

    const updateCode = () => {
      const generated = pythonGenerator.workspaceToCode(workspace)
      setCode(generated.trim() || EMPTY_CODE)
    }

    updateCode()
    workspace.addChangeListener(updateCode)

    const resize = () => Blockly.svgResize(workspace)
    window.addEventListener('resize', resize)
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    return () => {
      workspace.removeChangeListener(updateCode)
      observer.disconnect()
      window.removeEventListener('resize', resize)
      workspace.dispose()
    }
  }, [])

  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const root = rootRef.current
    if (!root) return

    const rect = root.getBoundingClientRect()
    const previousUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'

    const onMove = (moveEvent: PointerEvent) => {
      const next = rect.right - moveEvent.clientX
      const max = rect.width - MIN_WORKSPACE_WIDTH
      setCodeWidth(Math.min(Math.max(next, MIN_CODE_WIDTH), max))
    }

    const onUp = () => {
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  return (
    <div
      ref={rootRef}
      style={{ '--code-width': `${codeWidth}px` } as CSSProperties}
      className="flex h-full w-full flex-col md:flex-row"
    >
      <div
        ref={containerRef}
        className="h-1/2 w-full min-h-0 md:h-full md:min-w-0 md:flex-1"
      />
      <div
        onPointerDown={startResize}
        className="group hidden cursor-col-resize touch-none items-center justify-center bg-gray-200 transition-colors hover:bg-indigo-400 md:flex md:w-2 md:shrink-0 dark:bg-gray-800 dark:hover:bg-indigo-500"
      >
        <div className="h-10 w-0.5 rounded-full bg-gray-400 group-hover:bg-white dark:bg-gray-600" />
      </div>
      <div className="flex h-1/2 w-full min-h-0 flex-col border-t border-gray-300 md:h-full md:w-(--code-width) md:shrink-0 md:border-t-0 md:border-l dark:border-gray-700">
        <div className="shrink-0 border-b border-gray-300 px-3 py-1.5 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:border-gray-700 dark:text-gray-400">
          Python
        </div>
        <pre className="min-h-0 flex-1 overflow-auto bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 dark:bg-gray-900 dark:text-gray-100">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}
