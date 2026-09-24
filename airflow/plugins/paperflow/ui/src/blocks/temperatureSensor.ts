import * as Blockly from 'blockly'
import { Order, pythonGenerator } from 'blockly/python'

export const TEMPERATURE_SENSOR_BLOCK = 'temperature_sensor'

Blockly.defineBlocksWithJsonArray([
  {
    type: TEMPERATURE_SENSOR_BLOCK,
    message0: 'Temperature Sensor',
    output: 'Number',
    colour: '#e0a35a',
    tooltip: 'Reads the temperature (°C) from the Raspberry Pi sensor.',
  },
])

pythonGenerator.forBlock[TEMPERATURE_SENSOR_BLOCK] = () => {
  const name = pythonGenerator.provideFunction_('read_temperature', [
    'def read_temperature():',
    '    # read from raspberry pi dht22',
    '    return temperature',
  ])

  return [`${name}()`, Order.FUNCTION_CALL]
}
