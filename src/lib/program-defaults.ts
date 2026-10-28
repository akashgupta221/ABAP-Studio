// Clean source templates for objects created through the SE38 create flow.
// They intentionally contain no demo output: after Local Object the user gets
// an empty, syntactically valid editor shell, exactly like the SAP GUI screens.

export type Se38ProgramType = 'REPORT' | 'CLASS' | 'INCLUDE' | 'FUNCTION_GROUP'

export function se38CreateSource(name: string, type: Se38ProgramType): string {
  const key = name.trim().toUpperCase()
  const lower = key.toLowerCase()
  switch (type) {
    case 'INCLUDE':
      return [
        '*&---------------------------------------------------------------------*',
        `*& Include ${key}`,
        '*&---------------------------------------------------------------------*',
        '',
      ].join('\n')
    case 'CLASS':
      return [
        `CLASS ${lower} DEFINITION.`,
        'ENDCLASS.',
        '',
        `CLASS ${lower} IMPLEMENTATION.`,
        'ENDCLASS.',
        '',
      ].join('\n')
    case 'FUNCTION_GROUP':
      return `FUNCTION-POOL ${lower}.\n`
    default:
      return `REPORT ${lower}.\n`
  }
}
