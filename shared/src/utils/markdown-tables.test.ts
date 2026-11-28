import { describe, expect, it } from 'vitest'
import { flattenMarkdownTables } from './markdown-tables'

describe('flattenMarkdownTables', () => {
  it('turns each row of a wide table into one list entry and drops empty cells', () => {
    const input = [
      'Here is your summary:',
      '| Subject | Section | Present | Rate |',
      '|---|:--:|---:|---|',
      '| **IT Elective** | 4-1 | 0 | — |',
      '| Programming | 2-2 | 5 | 83% |',
      'Ask me about one subject.',
    ].join('\n')

    expect(flattenMarkdownTables(input)).toBe(
      [
        'Here is your summary:',
        '',
        '- **IT Elective**  \n  Section: 4-1 · Present: 0',
        '- **Programming**  \n  Section: 2-2 · Present: 5 · Rate: 83%',
        '',
        'Ask me about one subject.',
      ].join('\n'),
    )
  })

  it('writes a two-column table as names and values', () => {
    expect(flattenMarkdownTables('| Item | Count |\n|---|---|\n| Present | 2 |\n| Late | 1 |')).toBe(
      '- **Present**: 2\n- **Late**: 1',
    )
  })

  it('also converts a table written without the outer pipes', () => {
    expect(flattenMarkdownTables('Subject | Rate\n--- | ---\nProgramming | 83%')).toBe('- **Programming**: 83%')
  })

  it('keeps an escaped pipe inside a cell', () => {
    expect(flattenMarkdownTables('| A | B |\n|---|---|\n| x \\| y | z |')).toBe('- **x | y**: z')
  })

  it.each([
    'Just a sentence with a | pipe in it.',
    '- one\n- two',
    '| not a table |\nbecause there is no divider',
    'A sentence with a | pipe\n---\nabove a rule',
    '```\n| a | b |\n|---|---|\n| 1 | 2 |\n```',
  ])('leaves other text alone: %j', (input) => {
    expect(flattenMarkdownTables(input)).toBe(input)
  })

  it('copes with a table that is still streaming in', () => {
    expect(flattenMarkdownTables('| Subject | Rate |\n|---|---|')).toBe('Subject · Rate')
  })
})
