import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnBeforeDelete,
  type OnEdgesChange,
  type OnNodesChange,
  type XYPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { WorkspaceSvg } from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { TASK_BLOCK, appendTaskBlock, slugify } from '../blocks/task'
import { BlocklyEditor } from '../components/BlocklyEditor'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ResultDialog, type ValidationCheck } from '../components/ResultDialog'
import { TaskNode, type TaskNodeType } from '../nodes/TaskNode'
import {
  ImageNode,
  type ImageNodeData,
  type ImageNodeType,
} from '../nodes/ImageNode'

const nodeTypes = { task: TaskNode, image: ImageNode }

const COLUMN_GAP = 240

const AVAILABLE_IMAGES = [
  { src: 'temp-sensor.png', label: 'Temp Sensor' },
  { src: 'humid-sensor.png', label: 'Humid Sensor' },
  // { src: 'soil-sensor.png', label: 'Soil Sensor' },
  { src: 'red-led.png', label: 'Red LED' },
  { src: 'blue-led.png', label: 'Blue LED' },
  { src: 'green-led.png', label: 'Green LED' },
]

const initialNodes: Node[] = [
  {
    id: 'temp-sensor',
    type: 'image',
    position: { x: 0, y: 0 },
    data: { src: 'temp-sensor.png', alt: 'Temp Sensor', label: 'Temp Sensor' },
  } satisfies ImageNodeType,
  {
    id: 'humid-sensor',
    type: 'image',
    position: { x: 0, y: COLUMN_GAP },
    data: {
      src: 'humid-sensor.png',
      alt: 'Humid Sensor',
      label: 'Humid Sensor',
    },
  } satisfies ImageNodeType,
  // {
  //   id: 'soil-sensor',
  //   type: 'image',
  //   position: { x: 0, y: COLUMN_GAP * 2 },
  //   data: { src: 'soil-sensor.png', alt: 'Soil Sensor', label: 'Soil Sensor' },
  // } satisfies ImageNodeType,
  {
    id: 'red-led',
    type: 'image',
    position: { x: 360, y: 0 },
    data: { src: 'red-led.png', alt: 'Red LED', label: 'Red LED' },
  } satisfies ImageNodeType,
  {
    id: 'blue-led',
    type: 'image',
    position: { x: 360, y: COLUMN_GAP },
    data: { src: 'blue-led.png', alt: 'Blue LED', label: 'Blue LED' },
  } satisfies ImageNodeType,
  {
    id: 'green-led',
    type: 'image',
    position: { x: 360, y: COLUMN_GAP * 2 },
    data: { src: 'green-led.png', alt: 'Green LED', label: 'Green LED' },
  } satisfies ImageNodeType,
]

const initialEdges: Edge[] = []

const STORAGE_KEY_NODES = 'paperflow:nodes'
const STORAGE_KEY_EDGES = 'paperflow:edges'
const STORAGE_KEY_NODE_BLOCK_MAP = 'paperflow:node-block-map'

function loadNodes(): Node[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NODES)
    return raw ? (JSON.parse(raw) as Node[]) : null
  } catch {
    return null
  }
}

function loadEdges(): Edge[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EDGES)
    return raw ? (JSON.parse(raw) as Edge[]) : null
  } catch {
    return null
  }
}

function loadNodeBlockMap(): [string, string][] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NODE_BLOCK_MAP)
    return raw ? (JSON.parse(raw) as [string, string][]) : []
  } catch {
    return []
  }
}

function saveNodes(nodes: Node[]) {
  localStorage.setItem(STORAGE_KEY_NODES, JSON.stringify(nodes))
}

function saveEdges(edges: Edge[]) {
  localStorage.setItem(STORAGE_KEY_EDGES, JSON.stringify(edges))
}

function saveNodeBlockMap(map: Map<string, string>) {
  localStorage.setItem(
    STORAGE_KEY_NODE_BLOCK_MAP,
    JSON.stringify([...map]),
  )
}

const COMPONENT_BY_SRC: Record<string, string> = {
  'temp-sensor.png': 'temperature',
  'humid-sensor.png': 'humidity',
  'red-led.png': 'led:red',
  'blue-led.png': 'led:blue',
  'green-led.png': 'led:green',
}

const COMPONENT_LABELS: Record<string, string> = {
  temperature: 'Temp Sensor',
  humidity: 'Humid Sensor',
  'led:red': 'Red LED',
  'led:blue': 'Blue LED',
  'led:green': 'Green LED',
}

function parseReferencedComponents(code: string): Set<string> {
  const found = new Set<string>()

  if (/\bread_temperature\s*\(/.test(code)) found.add('temperature')
  if (/\bread_humidity\s*\(/.test(code)) found.add('humidity')

  const ledRegex = /set_led\(\s*['"](\w+)['"]/g
  let match: RegExpExecArray | null
  while ((match = ledRegex.exec(code)) !== null) {
    found.add(`led:${match[1]}`)
  }

  return found
}

function resolveTaskBlockId(
  workspace: WorkspaceSvg,
  node: Node,
  blockByName: Map<string, string>,
  savedById: Map<string, string>,
  linkedBlockId?: string,
): string | undefined {
  const data = node.data as TaskNodeType['data']

  const linked =
    linkedBlockId && workspace.getBlockById(linkedBlockId)
      ? linkedBlockId
      : undefined
  const saved = savedById.get(node.id)
  const resolved =
    linked ??
    (data.blockName ? blockByName.get(data.blockName) : undefined) ??
    (saved && workspace.getBlockById(saved) ? saved : undefined)

  if (resolved) return resolved

  const slug = slugify(data.label)
  if (blockByName.has(slug)) return blockByName.get(slug)

  for (const [name, blockId] of blockByName) {
    if (name.startsWith(`${slug}_`)) return blockId
  }

  return undefined
}

function buildBlockNameMap(workspace: WorkspaceSvg): Map<string, string> {
  return new Map(
    workspace
      .getAllBlocks(false)
      .map((block) => [block.getFieldValue('NAME') as string, block.id]),
  )
}

type FlowProps = {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: OnNodesChange<Node>
  onEdgesChange: OnEdgesChange<Edge>
  onConnect: (connection: Connection) => void
  onBeforeDelete: OnBeforeDelete<Node, Edge>
  onNodesDelete: (nodes: Node[]) => void
  onAddTask: (position: XYPosition, label: string) => void
  onAddImage: (position: XYPosition, src: string, label: string) => void
}

function Flow({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onBeforeDelete,
  onNodesDelete,
  onAddTask,
  onAddImage,
}: FlowProps) {
  const [taskText, setTaskText] = useState('')
  const [dark, setDark] = useState(false)
  const { screenToFlowPosition } = useReactFlow()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const usedSources = new Set(
    nodes
      .filter((node) => node.type === 'image')
      .map((node) => (node.data as ImageNodeData).src),
  )

  const getCenterPosition = useCallback(
    () =>
      screenToFlowPosition({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
        y: window.innerHeight / 2 + (Math.random() - 0.5) * 80,
      }),
    [screenToFlowPosition],
  )

  const handleAddTask = useCallback(() => {
    onAddTask(
      getCenterPosition(),
      taskText.trim() || `Task ${nodes.length + 1}`,
    )
    setTaskText('')
  }, [getCenterPosition, nodes.length, onAddTask, taskText])

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source)
      const targetNode = nodes.find((n) => n.id === connection.target)
      if (!sourceNode || !targetNode) return false
      return !(sourceNode.type === 'image' && targetNode.type === 'image')
    },
    [nodes],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onBeforeDelete={onBeforeDelete}
      onNodesDelete={onNodesDelete}
      nodeTypes={nodeTypes}
      isValidConnection={isValidConnection}
      deleteKeyCode={['Backspace', 'Delete']}
      fitView
      className="h-full w-full bg-gray-50 dark:bg-gray-900"
    >
      <Panel position="top-left">
        <div className="flex w-56 flex-col gap-3 rounded-xl border border-gray-300 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={taskText}
              onChange={(event) => setTaskText(event.target.value)}
              placeholder="Task name"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={handleAddTask}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-indigo-400 active:bg-indigo-600"
            >
              + Add Task
            </button>
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
            <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              Components
            </span>
            <div className="grid grid-cols-3 gap-2">
              {AVAILABLE_IMAGES.map((image) => {
                const isUsed = usedSources.has(image.src)

                return (
                  <button
                    key={image.src}
                    type="button"
                    title={
                      isUsed
                        ? `${image.label} already on canvas`
                        : `Add ${image.label}`
                    }
                    disabled={isUsed}
                    onClick={() =>
                      onAddImage(getCenterPosition(), image.src, image.label)
                    }
                    className={`flex flex-col items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 p-1.5 transition-colors dark:border-gray-700 dark:bg-gray-900 ${
                      isUsed
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:border-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <img
                      src={image.src}
                      alt={image.label}
                      className="h-8 w-8 object-contain"
                    />
                    <span className="w-full truncate text-center text-[10px] text-gray-500 dark:text-gray-400">
                      {image.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setDark((value) => !value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {dark ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </div>
      </Panel>
      <Panel position="top-right">
        <button
          type="button"
          onClick={() => navigate('/wiring')}
          className="rounded-lg border border-gray-300 bg-white/95 px-4 py-2 text-sm font-medium text-gray-700 shadow-lg backdrop-blur transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Raspberry PI Wiring
        </button>
      </Panel>
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color={dark ? '#334155' : '#cbd5e1'}
      />
      <Controls />
      <MiniMap className="bg-white! dark:bg-gray-800!" pannable zoomable />
    </ReactFlow>
  )
}

const MIN_BLOCKLY_HEIGHT = 140
const MIN_FLOW_HEIGHT = 180

function Builder() {
  const containerRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<WorkspaceSvg | null>(null)
  const taskBlockCountRef = useRef(0)
  const nodeToBlockRef = useRef(new Map<string, string>())
  const blockToNodeRef = useRef(new Map<string, string>())
  const confirmResolveRef = useRef<((confirmed: boolean) => void) | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{
    itemCount: number
    taskCount: number
  } | null>(null)
  const [validationChecks, setValidationChecks] = useState<
    ValidationCheck[] | null
  >(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(
    loadNodes() ?? initialNodes,
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    loadEdges() ?? initialEdges,
  )
  const [blocklyHeight, setBlocklyHeight] = useState(() =>
    Math.max(240, Math.round(window.innerHeight * 0.4)),
  )

  useEffect(() => {
    saveNodes(nodes)
  }, [nodes])

  useEffect(() => {
    saveEdges(edges)
  }, [edges])

  useEffect(() => {
    const selectedIds = new Set(
      nodes.filter((node) => node.selected).map((node) => node.id),
    )
    setEdges((eds) => {
      let changed = false
      const next = eds.map((edge) => {
        const shouldAnimate =
          selectedIds.has(edge.source) || selectedIds.has(edge.target)
        if (Boolean(edge.animated) === shouldAnimate) return edge
        changed = true
        return { ...edge, animated: shouldAnimate }
      })
      return changed ? next : eds
    })
  }, [nodes, setEdges])

  useEffect(() => {
    saveNodeBlockMap(nodeToBlockRef.current)
  }, [nodes])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  )

  const handleGenerateDag = useCallback(() => {
    const workspace = workspaceRef.current
    if (!workspace) return

    const checks: ValidationCheck[] = []
    const blockByName = buildBlockNameMap(workspace)
    const savedById = new Map(loadNodeBlockMap())

    for (const node of nodes) {
      if (node.type !== 'task') continue

      const blockId = resolveTaskBlockId(
        workspace,
        node,
        blockByName,
        savedById,
        nodeToBlockRef.current.get(node.id),
      )
      const block = blockId ? workspace.getBlockById(blockId) : null
      if (!block) continue

      const code = pythonGenerator.blockToCode(block) as string
      const referenced = parseReferencedComponents(code)

      const connected = new Set<string>()
      for (const edge of edges) {
        const otherId =
          edge.source === node.id
            ? edge.target
            : edge.target === node.id
              ? edge.source
              : null
        if (!otherId) continue

        const other = nodes.find((n) => n.id === otherId)
        if (other?.type !== 'image') continue

        const key = COMPONENT_BY_SRC[(other.data as ImageNodeData).src]
        if (key) connected.add(key)
      }

      for (const key of new Set([...referenced, ...connected])) {
        const used = referenced.has(key)
        const wired = connected.has(key)
        const label = COMPONENT_LABELS[key]

        let text = `${label} validated`
        if (used && !wired) text = `${label} is not connected`
        else if (!used && wired) text = `${label} is not used`

        checks.push({
          id: `${node.id}:${key}`,
          task: (node.data as TaskNodeType['data']).label,
          ok: used && wired,
          text,
        })
      }
    }

    setValidationChecks(checks)
  }, [edges, nodes])

  const handleWorkspace = useCallback((workspace: WorkspaceSvg | null) => {
    workspaceRef.current = workspace

    if (!workspace) {
      taskBlockCountRef.current = 0
      nodeToBlockRef.current.clear()
      blockToNodeRef.current.clear()
      return
    }

    const savedById = new Map(loadNodeBlockMap())
    const blockByName = buildBlockNameMap(workspace)

    for (const node of nodes) {
      if (node.type !== 'task') continue

      const blockId = resolveTaskBlockId(
        workspace,
        node,
        blockByName,
        savedById,
      )
      if (!blockId) continue

      nodeToBlockRef.current.set(node.id, blockId)
      blockToNodeRef.current.set(blockId, node.id)
    }

    taskBlockCountRef.current = workspace
      .getAllBlocks(false)
      .filter((block) => block.type === TASK_BLOCK).length
  }, [nodes])

  const handleAddTask = useCallback(
    (position: XYPosition, label: string) => {
      const nodeId = crypto.randomUUID()
      const workspace = workspaceRef.current

      let blockName: string | undefined
      if (workspace) {
        const block = appendTaskBlock(
          workspace,
          label,
          taskBlockCountRef.current,
        )
        taskBlockCountRef.current += 1
        blockName = block.getFieldValue('NAME') as string
        nodeToBlockRef.current.set(nodeId, block.id)
        blockToNodeRef.current.set(block.id, nodeId)
      }

      setNodes((nds) => [
        ...nds,
        {
          id: nodeId,
          type: 'task',
          position,
          data: { label, blockName },
        } satisfies TaskNodeType,
      ])
    },
    [setNodes],
  )

  const handleAddImage = useCallback(
    (position: XYPosition, src: string, label: string) => {
      setNodes((nds) => {
        const exists = nds.some(
          (node) =>
            node.type === 'image' && (node.data as ImageNodeData).src === src,
        )
        if (exists) return nds

        return [
          ...nds,
          {
            id: crypto.randomUUID(),
            type: 'image',
            position,
            data: { src, alt: label, label },
          } satisfies ImageNodeType,
        ]
      })
    },
    [setNodes],
  )

  const handleNodesDeleted = useCallback((deleted: Node[]) => {
    const workspace = workspaceRef.current

    for (const node of deleted) {
      const blockId = nodeToBlockRef.current.get(node.id)
      if (!blockId) continue

      nodeToBlockRef.current.delete(node.id)
      blockToNodeRef.current.delete(blockId)
      workspace?.getBlockById(blockId)?.dispose(true)
    }
  }, [])

  const handleBlockDeleted = useCallback(
    (blockIds: string[]) => {
      const removedNodeIds: string[] = []

      for (const blockId of blockIds) {
        const nodeId = blockToNodeRef.current.get(blockId)
        if (!nodeId) continue

        blockToNodeRef.current.delete(blockId)
        nodeToBlockRef.current.delete(nodeId)
        removedNodeIds.push(nodeId)
      }

      if (removedNodeIds.length === 0) return

      setNodes((nds) => nds.filter((node) => !removedNodeIds.includes(node.id)))
      setEdges((eds) =>
        eds.filter(
          (edge) =>
            !removedNodeIds.includes(edge.source) &&
            !removedNodeIds.includes(edge.target),
        ),
      )
    },
    [setEdges, setNodes],
  )

  const requestDeleteConfirmation = useCallback((nodesToDelete: Node[]) => {
    if (confirmResolveRef.current) return Promise.resolve(false)

    const taskCount = nodesToDelete.filter((node) => node.type === 'task').length

    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve
      setPendingDelete({ itemCount: nodesToDelete.length, taskCount })
    })
  }, [])

  const settleDeleteConfirmation = useCallback((confirmed: boolean) => {
    const resolve = confirmResolveRef.current
    confirmResolveRef.current = null
    setPendingDelete(null)
    resolve?.(confirmed)
  }, [])

  const handleBeforeDelete = useCallback(
    async ({ nodes: nodesToDelete }: { nodes: Node[]; edges: Edge[] }) =>
      nodesToDelete.length === 0
        ? true
        : requestDeleteConfirmation(nodesToDelete),
    [requestDeleteConfirmation],
  )

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const previousUserSelect = document.body.style.userSelect
      document.body.style.userSelect = 'none'

      const onMove = (moveEvent: PointerEvent) => {
        const next = rect.bottom - moveEvent.clientY
        const max = rect.height - MIN_FLOW_HEIGHT
        setBlocklyHeight(Math.min(Math.max(next, MIN_BLOCKLY_HEIGHT), max))
      }

      const onUp = () => {
        document.body.style.userSelect = previousUserSelect
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [],
  )

  let confirmMessage = ''
  if (pendingDelete) {
    const { itemCount, taskCount } = pendingDelete
    confirmMessage = `${itemCount} item${itemCount === 1 ? '' : 's'} will be removed from the canvas.`

    if (taskCount > 0) {
      confirmMessage += ` ${taskCount} task${taskCount === 1 ? '' : 's'} and the matching Blockly block${taskCount === 1 ? '' : 's'} will be deleted too.`
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex h-screen flex-col bg-gray-100 dark:bg-gray-950"
    >
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <Flow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onBeforeDelete={handleBeforeDelete}
            onNodesDelete={handleNodesDeleted}
            onAddTask={handleAddTask}
            onAddImage={handleAddImage}
          />
        </ReactFlowProvider>
      </div>
      <div
        onPointerDown={startResize}
        className="group flex h-2 shrink-0 cursor-row-resize touch-none items-center justify-center border-y border-gray-300 bg-gray-200 transition-colors hover:bg-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-indigo-500"
      >
        <div className="h-0.5 w-10 rounded-full bg-gray-400 group-hover:bg-white dark:bg-gray-600" />
      </div>
      <div
        style={{ height: blocklyHeight }}
        className="min-h-0 shrink-0 bg-white dark:bg-gray-900"
      >
        <BlocklyEditor
          onWorkspace={handleWorkspace}
          onBlockDelete={handleBlockDeleted}
          onGenerateDag={handleGenerateDag}
        />
      </div>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete selected items?"
        message={confirmMessage}
        onConfirm={() => settleDeleteConfirmation(true)}
        onCancel={() => settleDeleteConfirmation(false)}
      />
      <ResultDialog
        open={validationChecks !== null}
        checks={validationChecks ?? []}
        onClose={() => setValidationChecks(null)}
        onGenerate={() => setValidationChecks(null)}
      />
    </div>
  )
}

export default Builder
