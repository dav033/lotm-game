import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  agruparContenidoPorBloqueadores,
  agruparElementosDeFase,
  compararCercaniaBloqueo,
  filtrarCandidatosIniciales,
} from './agrupacionFases'

const phases = {
  first: {
    id: 'phase-1',
    ownElementIds: ['starter', 'phase-1-result'],
  },
  second: {
    id: 'phase-2',
    ownElementIds: ['phase-2-opening', 'phase-2-result'],
  },
  inactive: {
    id: 'phase-inactive',
    ownElementIds: ['inactive-phase-opening'],
  },
  future: {
    id: 'phase-3',
    ownElementIds: ['future'],
  },
}

const allPhases = Object.values(phases)

const elements = [
  {
    id: 'starter',
    slug: 'starter',
    availableFromPhaseId: 'phase-1',
  },
  {
    id: 'phase-1-result',
    slug: 'phase-1-result',
    availableFromPhaseId: null,
  },
  {
    id: 'phase-2-opening',
    slug: 'phase-2-opening',
    availableFromPhaseId: 'phase-2',
  },
  {
    id: 'phase-2-result',
    slug: 'phase-2-result',
    availableFromPhaseId: null,
  },
  {
    id: 'future',
    slug: 'future',
    availableFromPhaseId: 'phase-3',
  },
  {
    id: 'blocked',
    slug: 'blocked',
    availableFromPhaseId: null,
  },
  {
    id: 'inactive-phase-opening',
    slug: 'inactive-phase-opening',
    availableFromPhaseId: 'phase-inactive',
  },
] as const

describe('agrupación visual de fases', () => {
  it('muestra los iniciales y resultados calculados de la primera fase', () => {
    const grouped = agruparElementosDeFase(elements, phases.first, allPhases)

    assert.deepEqual(
      grouped.phaseElements.map((element) => element.slug),
      ['starter', 'phase-1-result'],
    )
    assert.deepEqual(
      grouped.poolElements.map((element) => element.slug),
      ['blocked'],
    )
  })

  it('no devuelve resultados de otras fases al grupo sin pertenencia', () => {
    const grouped = agruparElementosDeFase(elements, phases.second, allPhases)

    assert.deepEqual(
      grouped.phaseElements.map((element) => element.slug),
      ['phase-2-opening', 'phase-2-result'],
    )
    assert.deepEqual(
      grouped.poolElements.map((element) => element.slug),
      ['blocked'],
    )
  })

  it('mantiene visible el inicial asignado a una fase inactiva', () => {
    const grouped = agruparElementosDeFase(elements, phases.inactive, allPhases)

    assert.deepEqual(
      grouped.phaseElements.map((element) => element.slug),
      ['inactive-phase-opening'],
    )
  })
})

describe('filtrarCandidatosIniciales', () => {
  it('ofrece solo elementos sin receta, secuencia Beyonder ni apertura en otra fase', () => {
    const candidates = filtrarCandidatosIniciales(
      [
        { id: 'libre' },
        { id: 'con-receta' },
        { id: 'inicial-otra-fase' },
        { id: 'secuencia-beyonder', isBeyonderSequence: true },
        { id: 'beyonder-sin-secuencia', isBeyonderSequence: false },
      ],
      ['inicial-otra-fase'],
      ['con-receta'],
    )

    assert.deepEqual(candidates, [
      { id: 'libre' },
      { id: 'beyonder-sin-secuencia', isBeyonderSequence: false },
    ])
  })
})

describe('agruparContenidoPorBloqueadores', () => {
  it('agrupa elementos y rituales por la misma combinación sin duplicarlos', () => {
    const grouped = agruparContenidoPorBloqueadores([
      {
        id: 'elemento-a',
        kind: 'elemento' as const,
        blockerIds: ['conocimiento', 'cambio'],
        targetElementId: 'elemento-a',
        fallbackGroup: 'Sin ruta activa',
      },
      {
        id: 'ritual-a',
        kind: 'ritual' as const,
        blockerIds: ['cambio', 'conocimiento'],
        fallbackGroup: 'Sin ruta activa',
      },
    ])

    assert.equal(grouped.length, 1)
    assert.deepEqual(grouped[0].blockerIds, ['cambio', 'conocimiento'])
    assert.deepEqual(grouped[0].items.map((item) => item.id), ['elemento-a', 'ritual-a'])
  })

  it('convierte el autobloqueo de un elemento en un grupo sin ruta', () => {
    const grouped = agruparContenidoPorBloqueadores([{
      id: 'sin-ruta',
      kind: 'elemento' as const,
      blockerIds: ['sin-ruta'],
      targetElementId: 'sin-ruta',
      fallbackGroup: 'Sin ruta activa',
    }])

    assert.deepEqual(grouped, [{
      key: 'motivo:Sin ruta activa',
      blockerIds: [],
      fallbackGroup: 'Sin ruta activa',
      items: [{
        id: 'sin-ruta',
        kind: 'elemento',
        blockerIds: ['sin-ruta'],
        targetElementId: 'sin-ruta',
        fallbackGroup: 'Sin ruta activa',
      }],
    }])
  })
})

describe('compararCercaniaBloqueo', () => {
  const items = [
    { id: 'dos-faltantes', missingCount: 2, distance: 1 },
    { id: 'cadena-larga', missingCount: 1, distance: 3 },
    { id: 'directo', missingCount: 1, distance: 1 },
    { id: 'sin-ruta', missingCount: 0, distance: null },
  ]

  it('prioriza menos faltantes, menos pasos y deja sin ruta al final', () => {
    const ordered = [...items].sort((left, right) =>
      compararCercaniaBloqueo(left, right, 'cercanos'),
    )
    assert.deepEqual(ordered.map((item) => item.id), [
      'directo',
      'cadena-larga',
      'dos-faltantes',
      'sin-ruta',
    ])
  })

  it('invierte exactamente el orden para mostrar primero los más lejanos', () => {
    const ordered = [...items].sort((left, right) =>
      compararCercaniaBloqueo(left, right, 'lejanos'),
    )
    assert.deepEqual(ordered.map((item) => item.id), [
      'sin-ruta',
      'dos-faltantes',
      'cadena-larga',
      'directo',
    ])
  })
})
