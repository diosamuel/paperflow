import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

export const SLEEP_BLOCK = 'sleep'

Blockly.defineBlocksWithJsonArray([
  {
    type: SLEEP_BLOCK,
    message0: 'sleep %1 seconds',
    args0: [
      {
        type: 'field_number',
        name: 'SECONDS',
        value: 1,
        min: 0,
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#5b80a5',
    tooltip: 'Pauses the workflow for the given number of seconds (time.sleep).',
  },
])

pythonGenerator.forBlock[SLEEP_BLOCK] = (block) => {
  const seconds = block.getFieldValue('SECONDS')

  return `time.sleep(${seconds})\n`
}
