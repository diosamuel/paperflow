import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
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

import { appendTaskBlock } from '../blocks/task'
import { BlocklyEditor } from '../components/BlocklyEditor'
import { ConfirmDialog } from '../components/ConfirmDialog'
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

const initialEdges: Edge[] = [
  { id: 'e-temp-humid', source: 'temp-sensor', target: 'humid-sensor' },
  // { id: 'e-humid-soil', source: 'humid-sensor', target: 'soil-sensor' },
  { id: 'e-red-blue', source: 'red-led', target: 'blue-led' },
  { id: 'e-blue-green', source: 'blue-led', target: 'green-led' },
]

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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [blocklyHeight, setBlocklyHeight] = useState(() =>
    Math.max(240, Math.round(window.innerHeight * 0.4)),
  )

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  )

  const handleWorkspace = useCallback((workspace: WorkspaceSvg | null) => {
    workspaceRef.current = workspace
    if (workspace) return

    taskBlockCountRef.current = 0
    nodeToBlockRef.current.clear()
    blockToNodeRef.current.clear()
  }, [])

  const handleAddTask = useCallback(
    (position: XYPosition, label: string) => {
      const nodeId = crypto.randomUUID()

      setNodes((nds) => [
        ...nds,
        {
          id: nodeId,
          type: 'task',
          position,
          data: { label },
        } satisfies TaskNodeType,
      ])

      const workspace = workspaceRef.current
      if (!workspace) return

      const block = appendTaskBlock(
        workspace,
        label,
        taskBlockCountRef.current,
      )
      taskBlockCountRef.current += 1
      nodeToBlockRef.current.set(nodeId, block.id)
      blockToNodeRef.current.set(block.id, nodeId)
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
        />
      </div>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete selected items?"
        message={confirmMessage}
        onConfirm={() => settleDeleteConfirmation(true)}
        onCancel={() => settleDeleteConfirmation(false)}
      />
    </div>
  )
}

export default Builder
