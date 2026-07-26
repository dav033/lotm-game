import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseMapEntries } from './mapEntries'

describe('parseMapEntries', () => {
  it('divide cada linea en etiquetas y valor por la flecha', () => {
    assert.deepEqual(
      parseMapEntries('Door · Change · King of Space-Time -> Door, Space, Seals, Alternate Worlds\nBizarreness · Spirit World -> Replication'),
      [
        { tags: 'Door · Change · King of Space-Time', value: 'Door, Space, Seals, Alternate Worlds' },
        { tags: 'Bizarreness · Spirit World', value: 'Replication' },
      ],
    )
  })

  it('usa la linea entera como valor sin etiquetas si no hay flecha', () => {
    assert.deepEqual(parseMapEntries('Solo un valor'), [{ tags: '', value: 'Solo un valor' }])
  })

  it('ignora lineas vacias y filas sin valor', () => {
    assert.deepEqual(parseMapEntries('  \nTags only ->  \nTags -> Value  \n'), [{ tags: 'Tags', value: 'Value' }])
  })
})
