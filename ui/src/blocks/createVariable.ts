import * as Blockly from 'blockly'
import { Order, pythonGenerator } from 'blockly/python'

export const CREATE_VARIABLE_BLOCK = 'create_variable'

Blockly.defineBlocksWithJsonArray([
  {
    type: CREATE_VARIABLE_BLOCK,
    message0: 'create variable %1 with value %2',
    args0: [
      {
        type: 'field_input',
        name: 'NAME',
        text: 'humidity',
        spellcheck: false,
      },
      {
        type: 'input_value',
        name: 'VALUE',
        check: ['Number', 'String'],
        align: 'RIGHT',
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: '#f5d75e',
    tooltip: 'Creates a variable and gives it a starting value.',
  },
])

function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/[^\w]/g, '')
  return cleaned || 'variable'
}

pythonGenerator.forBlock[CREATE_VARIABLE_BLOCK] = (block) => {
  const name = sanitizeName(block.getFieldValue('NAME'))
  const value =
    pythonGenerator.valueToCode(block, 'VALUE', Order.NONE) || '0'

  return `${name} = ${value}\n`
}
