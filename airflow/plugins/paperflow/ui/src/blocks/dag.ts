import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

export const DAG_BLOCK = 'dag'

export const SCHEDULE_OPTIONS = [
  ['@daily', '@daily'],
  ['@hourly', '@hourly'],
  ['@weekly', '@weekly'],
  ['@monthly', '@monthly'],
  ['@yearly', '@yearly'],
  ['@once', '@once'],
  ['Cron * * * * *', '* * * * *'],
]

Blockly.defineBlocksWithJsonArray([
  {
    type: DAG_BLOCK,
    message0: 'DAG %1',
    args0: [
      {
        type: 'field_input',
        name: 'NAME',
        text: 'paperflow_dag',
        spellcheck: false,
      },
    ],
    message1: 'schedule %1',
    args1: [
      {
        type: 'field_dropdown',
        name: 'SCHEDULE',
        options: SCHEDULE_OPTIONS,
      },
    ],
    message2: 'tasks %1',
    args2: [
      {
        type: 'input_statement',
        name: 'BODY',
      },
    ],
    colour: '#2a7de1',
    tooltip:
      'The DAG: one function that holds your tasks, the way Airflow defines a workflow.',
  },
])

pythonGenerator.forBlock[DAG_BLOCK] = (block) => {
  const name = block.getFieldValue('NAME') as string
  const schedule = block.getFieldValue('SCHEDULE') as string
  const body = pythonGenerator.statementToCode(block, 'BODY').trimEnd()

  const lines = body ? `${body}\n` : '  pass\n'

  return `@dag(schedule="${schedule}")\ndef ${name}():\n${lines}\n${name}()\n`
}
