import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import * as Blockly from 'blockly'
import 'blockly/blocks'
import { pythonGenerator } from 'blockly/python'
import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'

import { toolbox } from '../toolbox'

hljs.registerLanguage('python', python)

const EMPTY_CODE = '# Drag blocks to generate Python'
const MIN_CODE_WIDTH = 160
const MIN_WORKSPACE_WIDTH = 220

const PRESET_VARIABLES = ['temperature', 'humidity']
const STORAGE_KEY_BLOCKLY = 'paperflow:blockly'

function loadBlocklyState(): object | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BLOCKLY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveBlocklyState(state: object) {
  localStorage.setItem(STORAGE_KEY_BLOCKLY, JSON.stringify(state))
}

type BlocklyEditorProps = {
  onWorkspace?: (workspace: Blockly.WorkspaceSvg | null) => void
  onBlockDelete?: (blockIds: string[]) => void
  onGenerateDag?: () => void
}

export function BlocklyEditor({
  onWorkspace,
  onBlockDelete,
  onGenerateDag,
}: BlocklyEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const onWorkspaceRef = useRef(onWorkspace)
  const onBlockDeleteRef = useRef(onBlockDelete)
  const [code, setCode] = useState(EMPTY_CODE)
  const [codeWidth, setCodeWidth] = useState(() =>
    Math.max(MIN_CODE_WIDTH, Math.round(window.innerWidth * 0.3)),
  )

  const highlightedCode = useMemo(
    () => hljs.highlight(code, { language: 'python' }).value,
    [code],
  )

  useEffect(() => {
    onWorkspaceRef.current = onWorkspace
  }, [onWorkspace])

  useEffect(() => {
    onBlockDeleteRef.current = onBlockDelete
  }, [onBlockDelete])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const workspace = Blockly.inject(container, {
      toolbox,
      grid: { spacing: 20, length: 3, colour: '#cbd5e1', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.9 },
      move: { scrollbars: true, drag: true, wheel: true },
    })

    const variableMap = workspace.getVariableMap()
    for (const name of PRESET_VARIABLES) variableMap.createVariable(name)

    const saved = loadBlocklyState()
    if (saved) {
      try {
        Blockly.serialization.workspaces.load(saved, workspace)
      } catch (error) {
        console.warn('Discarding saved Blockly workspace:', error)
        localStorage.removeItem(STORAGE_KEY_BLOCKLY)
      }
    }

    onWorkspaceRef.current?.(workspace)

    const updateCode = () => {
      const generated = pythonGenerator.workspaceToCode(workspace)
      setCode(generated.trim() || EMPTY_CODE)
    }

    const saveWorkspace = () => {
      const state = Blockly.serialization.workspaces.save(workspace)
      saveBlocklyState(state)
    }

    const onDelete = (event: Blockly.Events.Abstract) => {
      if (event.type !== Blockly.Events.BLOCK_DELETE) return

      const { ids } = event as Blockly.Events.BlockDelete
      if (ids && ids.length > 0) onBlockDeleteRef.current?.(ids)
    }

    updateCode()
    workspace.addChangeListener(updateCode)
    workspace.addChangeListener(saveWorkspace)
    workspace.addChangeListener(onDelete)

    const resize = () => Blockly.svgResize(workspace)
    window.addEventListener('resize', resize)
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    return () => {
      workspace.removeChangeListener(updateCode)
      workspace.removeChangeListener(saveWorkspace)
      workspace.removeChangeListener(onDelete)
      observer.disconnect()
      window.removeEventListener('resize', resize)
      onWorkspaceRef.current?.(null)
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
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-300 px-3 py-1.5 dark:border-gray-700">
          <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Python
          </span>
          <button
            type="button"
            onClick={() => onGenerateDag?.()}
            disabled={!onGenerateDag}
            title={
              onGenerateDag
                ? 'Validate the workflow against your blocks'
                : 'Not implemented yet'
            }
            className="rounded-md bg-indigo-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-400 active:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Validate Code
          </button>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 dark:bg-gray-900 dark:text-gray-100">
          <code
            className="hljs"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>
    </div>
  )
}
