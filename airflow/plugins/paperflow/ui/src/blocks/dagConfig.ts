import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

export const DAG_CONFIG_BLOCK = 'dag_config'

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
    type: DAG_CONFIG_BLOCK,
    message0: 'set schedule %1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'SCHEDULE',
        options: SCHEDULE_OPTIONS,
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#2a7de1',
    tooltip:
      'Set how often this DAG runs. Pick a schedule like @daily or use a cron expression.',
  },
])

pythonGenerator.forBlock[DAG_CONFIG_BLOCK] = (block) => {
  const schedule = block.getFieldValue('SCHEDULE') as string

  pythonGenerator.provideFunction_('set_schedule', [
    'def set_schedule(schedule):',
    `    # Set the Airflow DAG schedule interval to '${schedule}'.`,
    '    pass',
  ])

  return `set_schedule('${schedule}')\n`
}
