import * as Blockly from 'blockly'
import { Order, pythonGenerator } from 'blockly/python'

import { DAG_BLOCK } from './dag'

export const TASK_BLOCK = 'task'

Blockly.defineBlocksWithJsonArray([
  {
    type: TASK_BLOCK,
    message0: 'task %1',
    args0: [
      {
        type: 'field_input',
        name: 'NAME',
        text: 'task',
        spellcheck: false,
      },
    ],
    message1: 'body %1',
    args1: [
      {
        type: 'input_statement',
        name: 'BODY',
      },
    ],
    message2: 'return %1',
    args2: [
      {
        type: 'input_value',
        name: 'RETURN',
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#017CEE',
    tooltip:
      'One task. Blocks inside run when this task runs, and the returned value is passed on like an Airflow XCom.',
  },
])

export function slugify(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (/^[0-9]/.test(cleaned)) return `task_${cleaned}`
  return cleaned || 'task'
}

function uniqueTaskName(
  workspace: Blockly.Workspace,
  base: string,
  excludeId?: string,
): string {
  const taken = new Set(
    workspace
      .getAllBlocks(false)
      .filter((block) => block.type === TASK_BLOCK && block.id !== excludeId)
      .map((block) => block.getFieldValue('NAME') as string),
  )

  if (!taken.has(base)) return base

  let suffix = 2
  while (taken.has(`${base}_${suffix}`)) suffix += 1
  return `${base}_${suffix}`
}

export function renameTaskBlock(block: Blockly.Block, label: string): string {
  const name = uniqueTaskName(block.workspace, slugify(label), block.id)
  block.setFieldValue(name, 'NAME')
  return name
}

pythonGenerator.forBlock[TASK_BLOCK] = (block) => {
  const name = block.getFieldValue('NAME')
  const body = pythonGenerator.statementToCode(block, 'BODY')
  const returnValue = pythonGenerator.valueToCode(block, 'RETURN', Order.NONE)

  const lines: string[] = []
  if (body) lines.push(body)
  if (returnValue) lines.push(`  return ${returnValue}\n`)
  if (lines.length === 0) lines.push('  pass\n')

  return `def ${name}():\n${lines.join('')}\n`
}

export function appendTaskBlock(
  workspace: Blockly.WorkspaceSvg,
  label: string,
  index: number,
): Blockly.Block {
  const block = Blockly.serialization.blocks.append(
    {
      type: TASK_BLOCK,
      x: 20,
      y: 20 + index * 120,
      fields: { NAME: uniqueTaskName(workspace, slugify(label)) },
    },
    workspace,
  )

  const nameField = block.getField('NAME')
  if (nameField) nameField.EDITABLE = false

  nestIntoDag(block, workspace)

  return block
}

function nestIntoDag(block: Blockly.Block, workspace: Blockly.WorkspaceSvg) {
  const dagBlock = workspace
    .getAllBlocks(false)
    .find((candidate) => candidate.type === DAG_BLOCK)

  const bodyInput = dagBlock?.getInput('BODY')
  if (!bodyInput?.connection || !block.previousConnection) return

  let connection = bodyInput.connection
  let last = connection.targetBlock()

  while (last) {
    const next = last.nextConnection
    if (!next) return

    if (!next.targetBlock()) {
      connection = next
      break
    }

    last = next.targetBlock()
  }

  if (!connection.targetBlock()) {
    connection.connect(block.previousConnection)
  }
}
