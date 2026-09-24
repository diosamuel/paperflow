import { CALL_TASK_VALUE_BLOCK } from './blocks/callTask'
import { DAG_BLOCK } from './blocks/dag'
import { HUMIDITY_SENSOR_BLOCK } from './blocks/humiditySensor'
import { LED_BLOCK } from './blocks/led'
import { TEMPERATURE_SENSOR_BLOCK } from './blocks/temperatureSensor'

const block = (type: string) => ({ kind: 'block' as const, type })

const category = (name: string, colour: string, types: string[]) => ({
  kind: 'category' as const,
  name,
  colour,
  contents: types.map(block),
})

export const toolbox = {
  kind: 'categoryToolbox' as const,
  contents: [
    category('DAG Config', '#2a7de1', [DAG_BLOCK]),
    category('Tasks', '#7b3ff2', [CALL_TASK_VALUE_BLOCK]),
    category('Sensors & LEDs', '#7b3ff2', [
      TEMPERATURE_SENSOR_BLOCK,
      HUMIDITY_SENSOR_BLOCK,
      LED_BLOCK,
    ]),
    category('Logic', '#5b80a5', [
      'controls_if',
      'controls_ifelse',
      'logic_compare',
      'logic_operation',
      'logic_negate',
      'logic_boolean',
      'logic_null',
      'logic_ternary',
    ]),
    category('Loops', '#5ba55b', [
      'controls_repeat_ext',
      'controls_repeat',
      'controls_whileUntil',
      'controls_for',
      'controls_forEach',
      'controls_flow_statements',
    ]),
    category('Math', '#5b67a5', [
      'math_number',
      'math_arithmetic',
      'math_single',
      'math_trig',
      'math_constant',
      'math_number_property',
      'math_round',
      'math_on_list',
      'math_modulo',
      'math_constrain',
      'math_random_int',
      'math_random_float',
      'math_atan2',
      'math_change',
    ]),
    category('Text', '#5ba58c', [
      'text',
      'text_join',
      'text_append',
      'text_length',
      'text_isEmpty',
      'text_indexOf',
      'text_charAt',
      'text_getSubstring',
      'text_changeCase',
      'text_trim',
      'text_count',
      'text_replace',
      'text_reverse',
      'text_print',
      'text_prompt_ext',
      'text_prompt',
    ]),
    category('Lists', '#745ba5', [
      'lists_create_empty',
      'lists_create_with',
      'lists_repeat',
      'lists_length',
      'lists_isEmpty',
      'lists_indexOf',
      'lists_getIndex',
      'lists_setIndex',
      'lists_getSublist',
      'lists_sort',
      'lists_split',
      'lists_reverse',
    ]),
    {
      kind: 'category' as const,
      name: 'Variables',
      categorystyle: 'variable_category',
      custom: 'VARIABLE',
    },
    category('Functions', '#995ba5', [
      'procedures_defnoreturn',
      'procedures_defreturn',
      'procedures_callnoreturn',
      'procedures_callreturn',
      'procedures_ifreturn',
    ]),
  ],
}
