import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseTierText } from './tierText'

describe('parseTierText', () => {
  it('turns each non-empty line into a trimmed explanation point', () => {
    assert.deepEqual(
      parseTierText('  Strong early utility  \r\n\r\nFlexible matchups\n  Clear identity  '),
      ['Strong early utility', 'Flexible matchups', 'Clear identity'],
    )
  })

  it('removes optional list markers and ignores marker-only lines', () => {
    assert.deepEqual(
      parseTierText('- First\n* Second\n• Third\nPlain point\n  -  '),
      ['First', 'Second', 'Third', 'Plain point'],
    )
  })
})
