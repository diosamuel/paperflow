import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

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
    colour: '#7b3ff2',
    tooltip: 'The body of one task. Blocks inside run when this task runs.',
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

function uniqueTaskName(workspace: Blockly.Workspace, base: string): string {
  const taken = new Set(
    workspace
      .getAllBlocks(false)
      .filter((block) => block.type === TASK_BLOCK)
      .map((block) => block.getFieldValue('NAME') as string),
  )

  if (!taken.has(base)) return base

  let suffix = 2
  while (taken.has(`${base}_${suffix}`)) suffix += 1
  return `${base}_${suffix}`
}

pythonGenerator.forBlock[TASK_BLOCK] = (block) => {
  const name = block.getFieldValue('NAME')
  const body = pythonGenerator.statementToCode(block, 'BODY')

  return `def ${name}():\n${body || '  pass\n'}\n`
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

  return block
}
