import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  analizarProgresion,
  ritualesConSecuenciaOrigenInconsistente,
  type DiagElement,
  type DiagRecipe,
  type DiagSequence,
  type DiagAdvance,
  type DiagTrigger,
} from './diagnostico'

function el(
  id: string,
  overrides: Partial<DiagElement> & { name?: string; type?: string } = {},
): DiagElement {
  return {
    id,
    slug: id.toLowerCase(),
    name: id,
    type: 'OTRO',
    isStarter: false,
    isActive: true,
    unlockedByType: null,
    unlockedBySequenceNumber: null,
    requiredElementIds: [],
    ...overrides,
  }
}

function receta(
  id: string,
  ingredients: { elementId: string; quantity: number }[],
  outputElementIds: string[],
): DiagRecipe {
  return {
    id,
    inputKey: ingredients.map((i) => `${i.elementId}*${i.quantity}`).join('|'),
    isActive: true,
    ingredients,
    outputElementIds,
  }
}

function secuencia(
  id: string,
  elementId: string,
  number: number,
  overrides: Partial<DiagSequence> = {},
): DiagSequence {
  return {
    id,
    elementId,
    pathwayId: 'camino-1',
    number,
    name: `${number}`,
    isActive: true,
    ...overrides,
  }
}

function avance(
  id: string,
  sourceSequenceId: string,
  targetSequenceId: string,
  ingredients: { elementId: string; quantity: number }[],
  rituals: DiagAdvance['rituals'] = [],
): DiagAdvance {
  return {
    id,
    internalName: id,
    inputKey: ingredients.map((i) => `${i.elementId}*${i.quantity}`).join('|'),
    isActive: true,
    sourceSequenceId,
    targetSequenceId,
    ingredients,
    rituals,
  }
}

function ritual(
  id: string,
  advanceId: string,
  requiredSequenceNumber: number,
  ingredients: { elementId: string; quantity: number }[],
  failureOutputIds: string[] = [],
): DiagAdvance['rituals'][0] {
  return {
    id,
    advanceId,
    name: id,
    inputKey: ingredients.map((i) => `${i.elementId}*${i.quantity}`).join('|'),
    isActive: true,
    requiredSequenceNumber,
    ingredients,
    failureOutputIds,
  }
}

describe('analizarProgresion', () => {
  it('produce un elemento con una receta válida', () => {
    const a = el('A', { isStarter: true })
    const b = el('B', { isStarter: true })
    const c = el('C')
    const recipe = receta('r1', [
      { elementId: a.id, quantity: 1 },
      { elementId: b.id, quantity: 1 },
    ], [c.id])

    const res = analizarProgresion([a, b, c], [recipe], [], [], [])
    const cres = res.get(c.id)!
    assert.equal(cres.reachable, true)
    assert.equal(cres.depth, 1)
    assert.equal(cres.cost, 1)
    assert.equal(cres.bestRoute.kind, 'recipe')
    assert.equal(cres.alternatives, 1)
  })

  it('propaga desbloqueos espontáneos por número de secuencia', () => {
    const s1 = el('Sec1', { isStarter: true })
    const sec1 = secuencia('seq1', s1.id, 1)
    const desbloqueado = el('Desbloqueado', { unlockedBySequenceNumber: 1 })

    const res = analizarProgresion([s1, desbloqueado], [], [sec1], [], [])
    const dres = res.get(desbloqueado.id)!
    assert.equal(dres.reachable, true)
    assert.equal(dres.depth, 1)
    assert.equal(dres.cost, 0)
    assert.equal(dres.bestRoute.kind, 'spontaneous')
    assert.ok(dres.bestRoute.label.includes('secuencia 1'))
  })

  it('permite ascender sin ritual', () => {
    const ing1 = el('Ing1', { isStarter: true })
    const ing2 = el('Ing2', { isStarter: true })
    const src = el('Src', { isStarter: true })
    const tgt = el('Tgt')
    const srcSeq = secuencia('seq-src', src.id, 9)
    const tgtSeq = secuencia('seq-tgt', tgt.id, 8)
    const adv = avance('a1', srcSeq.id, tgtSeq.id, [
      { elementId: ing1.id, quantity: 1 },
      { elementId: ing2.id, quantity: 1 },
    ])

    const res = analizarProgresion(
      [ing1, ing2, src, tgt],
      [],
      [srcSeq, tgtSeq],
      [adv],
      [],
    )
    const tgtres = res.get(tgt.id)!
    assert.equal(tgtres.reachable, true)
    assert.equal(tgtres.bestRoute.kind, 'advance')
    assert.equal(tgtres.cost, 2)
    assert.equal(tgtres.depth, 2)
  })

  it('bloquea ascensión y consecuencias sin conocimiento ritual', () => {
    const ing1 = el('Ing1', { isStarter: true })
    const ing2 = el('Ing2', { isStarter: true })
    const src = el('Src', { isStarter: true })
    const ritualIng = el('RitualIng', { isStarter: true })
    const ritualKnowledge = el('RitualKnowledge', { slug: 'ritual' })
    const tgt = el('Tgt')
    const failure = el('Failure')

    const srcSeq = secuencia('seq-src', src.id, 9)
    const tgtSeq = secuencia('seq-tgt', tgt.id, 8)

    const adv = avance('a1', srcSeq.id, tgtSeq.id, [
      { elementId: ing1.id, quantity: 1 },
      { elementId: ing2.id, quantity: 1 },
    ], [
      ritual('rit1', 'a1', 5, [{ elementId: ritualIng.id, quantity: 1 }], [failure.id]),
    ])

    // Sin conocer la metodología no se prepara ni se exponen consecuencias.
    const res1 = analizarProgresion(
      [ing1, ing2, src, ritualIng, ritualKnowledge, tgt, failure],
      [],
      [srcSeq, tgtSeq],
      [adv],
      [],
    )
    assert.equal(res1.get(tgt.id)!.reachable, false)
    assert.equal(res1.get(failure.id)!.reachable, false)

    // Al descubrir Ritual, el origen exacto ya poseído permite preparar.
    const ritualKnowledgeDiscovered = { ...ritualKnowledge, isStarter: true }
    const res2 = analizarProgresion(
      [ing1, ing2, src, ritualIng, ritualKnowledgeDiscovered, tgt, failure],
      [],
      [srcSeq, tgtSeq],
      [adv],
      [],
    )
    assert.equal(res2.get(tgt.id)!.reachable, true)
    assert.equal(res2.get(tgt.id)!.bestRoute.kind, 'advance')
    assert.equal(res2.get(failure.id)!.reachable, true)
    assert.equal(res2.get(failure.id)!.bestRoute.kind, 'ritual-failure')
  })

  it('incluye los requisitos del ritual en costo y profundidad', () => {
    const a = el('A', { isStarter: true })
    const b = el('B', { isStarter: true })
    const src = el('Src', { isStarter: true })
    const gate = el('Gate', { isStarter: true })
    const ritualKnowledge = el('RitualKnowledge', { slug: 'ritual', isStarter: true })
    const ritualIngredient = el('RitualIngredient')
    const target = el('Target')
    const srcSeq = secuencia('seq-src', src.id, 9)
    const gateSeq = secuencia('seq-gate', gate.id, 5)
    const targetSeq = secuencia('seq-target', target.id, 8)
    const recipe = receta('ritual-ingredient', [{ elementId: a.id, quantity: 2 }], [
      ritualIngredient.id,
    ])
    const adv = avance(
      'advance',
      srcSeq.id,
      targetSeq.id,
      [
        { elementId: a.id, quantity: 1 },
        { elementId: b.id, quantity: 1 },
      ],
      [ritual('ritual', 'advance', 5, [{ elementId: ritualIngredient.id, quantity: 1 }])],
    )

    const res = analizarProgresion(
      [a, b, src, gate, ritualKnowledge, ritualIngredient, target],
      [recipe],
      [srcSeq, gateSeq, targetSeq],
      [adv],
    )

    assert.equal(res.get(target.id)!.cost, 3)
    assert.equal(res.get(target.id)!.depth, 3)
    assert.equal(res.get(target.id)!.routeRequiresRitual, true)
  })

  it('incluye consecuencias de todos los rituales alternativos', () => {
    const a = el('A', { isStarter: true })
    const b = el('B', { isStarter: true })
    const source = el('Source', { isStarter: true })
    const target = el('Target')
    const ritualKnowledge = el('RitualKnowledge', { slug: 'ritual', isStarter: true })
    const failure1 = el('Failure1')
    const failure2 = el('Failure2')
    const sourceSequence = secuencia('source-sequence', source.id, 9)
    const targetSequence = secuencia('target-sequence', target.id, 8)
    const adv = avance(
      'advance',
      sourceSequence.id,
      targetSequence.id,
      [
        { elementId: a.id, quantity: 1 },
        { elementId: b.id, quantity: 1 },
      ],
      [
        ritual('ritual-1', 'advance', 6, [], [failure1.id]),
        ritual('ritual-2', 'advance', 5, [], [failure2.id]),
      ],
    )

    const res = analizarProgresion(
      [a, b, source, ritualKnowledge, target, failure1, failure2],
      [],
      [sourceSequence, targetSequence],
      [adv],
    )

    assert.equal(res.get(failure1.id)!.reachable, true)
    assert.equal(res.get(failure2.id)!.reachable, true)
    assert.equal(res.get(failure1.id)!.bestRoute.kind, 'ritual-failure')
    assert.equal(res.get(failure2.id)!.bestRoute.kind, 'ritual-failure')
  })

  it('ignora recetas con más de 2 unidades', () => {
    const a = el('A', { isStarter: true })
    const b = el('B', { isStarter: true })
    const c = el('C', { isStarter: true })
    const out = el('Out')
    const invalid = receta('r1', [
      { elementId: a.id, quantity: 1 },
      { elementId: b.id, quantity: 1 },
      { elementId: c.id, quantity: 1 },
    ], [out.id])

    const res = analizarProgresion([a, b, c, out], [invalid], [], [], [])
    assert.equal(res.get(out.id)!.reachable, false)
  })

  it('termina con ciclos sin starters', () => {
    const a = el('A')
    const b = el('B')
    const r1 = receta('r1', [{ elementId: a.id, quantity: 2 }], [b.id])
    const r2 = receta('r2', [{ elementId: b.id, quantity: 2 }], [a.id])

    const res = analizarProgresion([a, b], [r1, r2], [], [], [])
    assert.equal(res.get(a.id)!.reachable, false)
    assert.equal(res.get(b.id)!.reachable, false)
    assert.equal(res.get(a.id)!.bestRoute.kind, 'unreachable')
  })

  it('calcula métricas básicas en cadena', () => {
    const a = el('A', { isStarter: true })
    const b = el('B')
    const c = el('C')
    const r1 = receta('r1', [{ elementId: a.id, quantity: 2 }], [b.id])
    const r2 = receta('r2', [
      { elementId: a.id, quantity: 1 },
      { elementId: b.id, quantity: 1 },
    ], [c.id])

    const res = analizarProgresion([a, b, c], [r1, r2], [], [], [])
    const ares = res.get(a.id)!
    const bres = res.get(b.id)!
    const cres = res.get(c.id)!

    assert.equal(ares.reachable, true)
    assert.equal(ares.depth, 0)
    assert.equal(ares.cost, 0)

    assert.equal(bres.reachable, true)
    assert.equal(bres.depth, 1)
    assert.equal(bres.cost, 1)

    assert.equal(cres.reachable, true)
    assert.equal(cres.depth, 2)
    assert.equal(cres.cost, 2)
  })

  it('cuenta participación en avances y rituales', () => {
    const ing1 = el('Ing1', { isStarter: true })
    const ing2 = el('Ing2', { isStarter: true })
    const src = el('Src', { isStarter: true })
    const ritualIng = el('RitualIng', { isStarter: true })
    const tgt = el('Tgt')

    const srcSeq = secuencia('seq-src', src.id, 9)
    const tgtSeq = secuencia('seq-tgt', tgt.id, 8)
    const adv = avance('a1', srcSeq.id, tgtSeq.id, [
      { elementId: ing1.id, quantity: 1 },
      { elementId: ing2.id, quantity: 1 },
    ], [
      ritual('rit1', 'a1', 9, [{ elementId: ritualIng.id, quantity: 1 }]),
    ])

    const res = analizarProgresion(
      [ing1, ing2, src, ritualIng, tgt],
      [],
      [srcSeq, tgtSeq],
      [adv],
      [],
    )
    assert.equal(res.get(ritualIng.id)!.participation.rituals, 1)
    assert.equal(res.get(src.id)!.participation.advances, 1)
    assert.equal(res.get(tgt.id)!.participation.advances, 1)
  })

  it('propaga triggers de desbloqueo por elemento', () => {
    const trigger = el('Trigger', { isStarter: true })
    const target = el('Target')
    const t: DiagTrigger = { elementId: target.id, triggerId: trigger.id }

    const res = analizarProgresion([trigger, target], [], [], [], [t])
    const tres = res.get(target.id)!
    assert.equal(tres.reachable, true)
    assert.equal(tres.bestRoute.kind, 'spontaneous')
    assert.ok(tres.bestRoute.label.includes(trigger.name))
    assert.equal(tres.alternatives, 1)
  })

  it('requiere todos los requisitos AND para desbloquear', () => {
    const req1 = el('Req1', { isStarter: true })
    const req2 = el('Req2', { isStarter: true })
    const target = el('Target', { requiredElementIds: [req1.id, req2.id] })

    // Con ambos requisitos el objetivo se desbloquea.
    const resTodos = analizarProgresion([req1, req2, target], [], [], [], [])
    const targetTodos = resTodos.get(target.id)!
    assert.equal(targetTodos.reachable, true)
    assert.equal(targetTodos.bestRoute.kind, 'spontaneous')
    assert.ok(targetTodos.bestRoute.label.toLowerCase().includes('requisito'))

    // Con un solo requisito el objetivo sigue bloqueado.
    const resUno = analizarProgresion([req1, target], [], [], [], [])
    const targetUno = resUno.get(target.id)!
    assert.equal(targetUno.reachable, false)
  })

  it('propaga requisitos AND en cascada', () => {
    const a = el('A', { isStarter: true })
    const b = el('B', { isStarter: true })
    const c = el('C', { requiredElementIds: [a.id, b.id] })
    const d = el('D', { requiredElementIds: [c.id] })

    const res = analizarProgresion([a, b, c, d], [], [], [], [])
    assert.equal(res.get(c.id)!.reachable, true)
    assert.equal(res.get(d.id)!.reachable, true)
    assert.equal(res.get(d.id)!.bestRoute.kind, 'spontaneous')
  })

  it('diagnostica números rituales distintos de la secuencia origen real', () => {
    const source = secuencia('source-sequence', 'source', 6)
    const target = secuencia('target-sequence', 'target', 5)
    const matching = ritual('matching', 'advance', 6, [])
    const mismatch = ritual('mismatch', 'advance', 7, [])
    const advance = avance('advance', source.id, target.id, [], [matching, mismatch])

    assert.deepEqual(
      ritualesConSecuenciaOrigenInconsistente(
        [matching, mismatch],
        [advance],
        [source, target],
      ),
      [
        {
          ritualId: 'mismatch',
          ritualName: 'mismatch',
          requiredSequenceNumber: 7,
          sourceSequenceNumber: 6,
        },
      ],
    )
  })
})
