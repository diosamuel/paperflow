import * as Blockly from 'blockly'
import { Order, pythonGenerator } from 'blockly/python'

export const HUMIDITY_SENSOR_BLOCK = 'humidity_sensor'

Blockly.defineBlocksWithJsonArray([
  {
    type: HUMIDITY_SENSOR_BLOCK,
    message0: 'Humidity Sensor',
    output: 'Number',
    colour: '#2a9d99',
    tooltip: 'Reads the humidity (%) from the Raspberry Pi sensor.',
  },
])

pythonGenerator.forBlock[HUMIDITY_SENSOR_BLOCK] = () => {
  const name = pythonGenerator.provideFunction_('read_humidity', [
    'def read_humidity():',
    '    # read from raspberry pi',
    '    return humidity',
  ])

  return [`${name}()`, Order.FUNCTION_CALL]
}
