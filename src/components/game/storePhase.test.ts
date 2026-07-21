import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ElementoDescubierto, InstanciaBandeja } from './tipos'
import { agregarAperturasBandeja } from './store'

function element(slug: string): ElementoDescubierto {
  return {
    kind: 'ELEMENT',
    id: slug,
    slug,
    name: slug,
    description: '',
    iconKey: 'sparkles',
    imageUrl: null,
    type: 'CONCEPTO',
    tier: 1,
    isMajorDiscovery: false,
    derivationLabel: null,
    firstDiscoveredAt: '',
    timesCreated: 1,
  }
}

describe('agregarAperturasBandeja', () => {
  it('conserva el lienzo, evita duplicados y distribuye las nuevas aperturas', () => {
    const existing: InstanciaBandeja = {
      instanceId: 'existing',
      elemento: element('agua'),
      x: 0.7,
      y: 0.8,
    }
    const result = agregarAperturasBandeja(
      [existing],
      [element('agua'), element('misticismo'), element('beyonder')],
    )
    assert.equal(result[0], existing)
    assert.deepEqual(result.map((item) => item.elemento.slug), ['agua', 'misticismo', 'beyonder'])
    assert.equal(new Set(result.slice(1).map((item) => `${item.x}:${item.y}`)).size, 2)
  })
})
