import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

export const LED_BLOCK = 'led'

Blockly.defineBlocksWithJsonArray([
  {
    type: LED_BLOCK,
    message0: 'turn %1 LED %2',
    args0: [
      {
        type: 'field_dropdown',
        name: 'COLOUR',
        options: [
          ['red', 'red'],
          ['blue', 'blue'],
          ['green', 'green'],
        ],
      },
      {
        type: 'field_dropdown',
        name: 'STATE',
        options: [
          ['on', 'on'],
          ['off', 'off'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#e05a5a',
    tooltip: 'Turns one of the Raspberry Pi LEDs on or off.',
  },
])

pythonGenerator.forBlock[LED_BLOCK] = (block) => {
  const colour = block.getFieldValue('COLOUR')
  const state = block.getFieldValue('STATE') === 'on' ? 'True' : 'False'

  pythonGenerator.provideFunction_('set_led', [
    'def set_led(colour, state):',
    '    # turn on led',
    '    pass',
  ])

  return `set_led('${colour}', ${state})\n`
}
