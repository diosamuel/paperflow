import * as Blockly from 'blockly'
import { Order, pythonGenerator } from 'blockly/python'

import { TASK_BLOCK } from './task'

export const CALL_TASK_VALUE_BLOCK = 'call_task_value'

const COLOR = '#017CEE'

export function taskNameOptions(
  this: Blockly.FieldDropdown,
): [string, string][] {
  const source = this.getSourceBlock()
  const names = source
    ? source.workspace
        .getAllBlocks(false)
        .filter((candidate) => candidate.type === TASK_BLOCK)
        .map((candidate) => candidate.getFieldValue('NAME') as string)
    : []

  if (names.length === 0) return [['(no tasks yet)', '']]

  return names.map((name) => [name, name])
}

Blockly.Extensions.register('callTaskOptions', function (this: Blockly.Block) {
  const field = this.getField('TASK') as Blockly.FieldDropdown
  field.setOptions(taskNameOptions)
})

Blockly.defineBlocksWithJsonArray([
  {
    type: CALL_TASK_VALUE_BLOCK,
    message0: 'result of task %1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'TASK',
        options: [['(no tasks yet)', '']],
      },
    ],
    output: null,
    colour: COLOR,
    tooltip: "Calls another task and uses the value it returns.",
    extensions: ['callTaskOptions'],
  },
])

pythonGenerator.forBlock[CALL_TASK_VALUE_BLOCK] = (block) => {
  const name = block.getFieldValue('TASK') as string
  if (!name) return ['None', Order.ATOMIC]
  return [`${name}()`, Order.FUNCTION_CALL]
}
