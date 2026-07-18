import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ABILITY_DEFINITIONS,
  calcularPotencialPorElemento,
  desbloqueosNuevos,
  entradaPotencialPublica,
  facultadesBloqueadas,
  facultadesDesdeSlugs,
  potentialTierFromCount,
  rangoDeTier,
  resultadoVidentePublico,
  type AplicacionAvancePotencial,
  type FormulaPotencial,
  type SnapshotPotencial,
} from './habilidades'

// ---------------------------------------------------------------------------
// Helpers de construcción de snapshots
// ---------------------------------------------------------------------------

function formula(parcial: Partial<FormulaPotencial> & { actionKey: string }): FormulaPotencial {
  return {
    ingredientElementIds: [],
    totalUnidades: 2,
    activa: true,
    ingredientesActivos: true,
    salidasValidas: true,
    ...parcial,
  }
}

function aplicacion(
  parcial: Partial<AplicacionAvancePotencial> & { actionKey: string },
): AplicacionAvancePotencial {
  return {
    sourceElementId: 'origen',
    targetElementId: 'destino',
    owned: true,
    advanceActivo: true,
    contenidoActivo: true,
    ritualSatisfecho: true,
    ...parcial,
  }
}

function snapshot(parcial: Partial<SnapshotPotencial>): SnapshotPotencial {
  return {
    discoveredElementIds: new Set(),
    resolvedInputKeys: new Set(),
    formulas: [],
    aplicaciones: [],
    ...parcial,
  }
}

// ---------------------------------------------------------------------------
// Desbloqueo de facultades
// ---------------------------------------------------------------------------

describe('facultadesDesdeSlugs', () => {
  it('sin descubrimientos, todo bloqueado', () => {
    const f = facultadesDesdeSlugs(new Set())
    assert.equal(f.seer.unlocked, false)
    assert.equal(f.savant.unlocked, false)
    assert.equal(f.mysteryPryer.unlocked, false)
    assert.equal(f.apprenticeMemory.unlocked, false)
  })

  it('seer descubierto desbloquea solo al Vidente', () => {
    const f = facultadesDesdeSlugs(new Set(['seer']))
    assert.equal(f.seer.unlocked, true)
    assert.equal(f.savant.unlocked, false)
    assert.equal(f.mysteryPryer.unlocked, false)
    assert.equal(f.apprenticeMemory.unlocked, false)
  })

  it('aprendiz descubierto desbloquea solo la Memoria del Aprendiz', () => {
    const f = facultadesDesdeSlugs(new Set(['aprendiz']))
    assert.equal(f.apprenticeMemory.unlocked, true)
    assert.equal(f.seer.unlocked, false)
    assert.equal(f.savant.unlocked, false)
    assert.equal(f.mysteryPryer.unlocked, false)
  })

  it('el slug estable identifica la facultad, nunca el nombre visible', () => {
    // "Aprendiz" (nombre visible) no debe desbloquear nada: solo el slug.
    const f = facultadesDesdeSlugs(new Set(['Aprendiz']))
    assert.equal(f.apprenticeMemory.unlocked, false)
  })

  it('savant descubierto desbloquea su marcador con capacidad 5 y uso 0', () => {
    const f = facultadesDesdeSlugs(new Set(['savant']))
    assert.equal(f.savant.unlocked, true)
    assert.deepEqual(f.savant, {
      unlocked: true,
      implemented: false,
      capacity: 5,
      used: 0,
    })
    assert.equal(f.seer.unlocked, false)
  })

  it('mystery-pryer descubierto desbloquea su visión', () => {
    const f = facultadesDesdeSlugs(new Set(['mystery-pryer']))
    assert.equal(f.mysteryPryer.unlocked, true)
    assert.equal(f.seer.unlocked, false)
  })

  it('el nombre visible no desbloquea: solo slugs estables', () => {
    const f = facultadesDesdeSlugs(new Set(['Seer', 'Vidente', 'SAVANT']))
    assert.equal(f.seer.unlocked, false)
    assert.equal(f.savant.unlocked, false)
  })

  it('los slugs requeridos son los estables del archivo', () => {
    assert.equal(ABILITY_DEFINITIONS.seer.requiredElementSlug, 'seer')
    assert.equal(ABILITY_DEFINITIONS.savant.requiredElementSlug, 'savant')
    assert.equal(ABILITY_DEFINITIONS.mysteryPryer.requiredElementSlug, 'mystery-pryer')
  })
})

describe('desbloqueosNuevos', () => {
  it('detecta la transición bloqueada → desbloqueada', () => {
    assert.deepEqual(desbloqueosNuevos(facultadesBloqueadas(), facultadesDesdeSlugs(new Set(['seer']))), [
      'seer',
    ])
  })

  it('no repite facultades ya desbloqueadas', () => {
    const antes = facultadesDesdeSlugs(new Set(['seer']))
    const despues = facultadesDesdeSlugs(new Set(['seer', 'savant']))
    assert.deepEqual(desbloqueosNuevos(antes, despues), ['savant'])
  })
})

// ---------------------------------------------------------------------------
// Potencial: fórmulas de recetas y creación de avances
// ---------------------------------------------------------------------------

describe('calcularPotencialPorElemento — fórmulas', () => {
  it('elemento y compañero descubiertos: la acción cuenta para ambos', () => {
    const s = snapshot({
      discoveredElementIds: new Set(['a', 'b']),
      formulas: [formula({ actionKey: 'a*1|b*1', ingredientElementIds: ['a', 'b'] })],
    })
    const conteos = calcularPotencialPorElemento(s)
    assert.equal(conteos.get('a'), 1)
    assert.equal(conteos.get('b'), 1)
  })

  it('compañero sin descubrir: la acción queda excluida', () => {
    const s = snapshot({
      discoveredElementIds: new Set(['a']),
      formulas: [formula({ actionKey: 'a*1|b*1', ingredientElementIds: ['a', 'b'] })],
    })
    const conteos = calcularPotencialPorElemento(s)
    assert.equal(conteos.get('a') ?? 0, 0)
  })

  it('fórmula inactiva: excluida', () => {
    const s = snapshot({
      discoveredElementIds: new Set(['a', 'b']),
      formulas: [formula({ actionKey: 'a*1|b*1', ingredientElementIds: ['a', 'b'], activa: false })],
    })
    assert.equal(calcularPotencialPorElemento(s).size, 0)
  })

  it('ingredientes inactivos (el resolvedor los rechaza): excluida', () => {
    const s = snapshot({
      discoveredElementIds: new Set(['a', 'b']),
      formulas: [
        formula({ actionKey: 'a*1|b*1', ingredientElementIds: ['a', 'b'], ingredientesActivos: false }),
      ],
    })
    assert.equal(calcularPotencialPorElemento(s).size, 0)
  })

  it('sin salidas válidas: excluida', () => {
    const s = snapshot({
      discoveredElementIds: new Set(['a', 'b']),
      formulas: [
        formula({ actionKey: 'a*1|b*1', ingredientElementIds: ['a', 'b'], salidasValidas: false }),
      ],
    })
    assert.equal(calcularPotencialPorElemento(s).size, 0)
  })

  it('más de dos unidades no es ejecutable en la mesa: excluida', () => {
    const s = snapshot({
      discoveredElementIds: new Set(['a', 'b', 'c']),
      formulas: [
        formula({ actionKey: 'a*1|b*1|c*1', ingredientElementIds: ['a', 'b', 'c'], totalUnidades: 3 }),
      ],
    })
    assert.equal(calcularPotencialPorElemento(s).size, 0)
  })

  it('inputKey ya resuelta con éxito: excluida', () => {
    const s = snapshot({
      discoveredElementIds: new Set(['a', 'b']),
      resolvedInputKeys: new Set(['a*1|b*1']),
      formulas: [formula({ actionKey: 'a*1|b*1', ingredientElementIds: ['a', 'b'] })],
    })
    assert.equal(calcularPotencialPorElemento(s).size, 0)
  })

  it('inputKey solo intentada (fallos sin éxito): sigue contando', () => {
    const s = snapshot({
      discoveredElementIds: new Set(['a', 'b']),
      // La clave NO está en resolvedInputKeys: solo hubo intentos fallidos.
      formulas: [formula({ actionKey: 'a*1|b*1', ingredientElementIds: ['a', 'b'] })],
    })
    assert.equal(calcularPotencialPorElemento(s).get('a'), 1)
  })

  it('una fórmula multisalida cuenta una sola vez', () => {
    const s = snapshot({
      discoveredElementIds: new Set(['a', 'b']),
      formulas: [formula({ actionKey: 'a*1|b*1', ingredientElementIds: ['a', 'b'] })],
    })
    const conteos = calcularPotencialPorElemento(s)
    assert.equal(conteos.get('a'), 1)
    assert.equal(conteos.get('b'), 1)
  })

  it('autocombinación (Tiempo + Tiempo): cuenta una sola vez', () => {
    const s = snapshot({
      discoveredElementIds: new Set(['a']),
      formulas: [formula({ actionKey: 'a*2', ingredientElementIds: ['a'], totalUnidades: 2 })],
    })
    assert.equal(calcularPotencialPorElemento(s).get('a'), 1)
  })

  it('receta y avance con la misma inputKey: una sola acción', () => {
    const s = snapshot({
      discoveredElementIds: new Set(['a', 'b']),
      formulas: [
        formula({ actionKey: 'a*1|b*1', ingredientElementIds: ['a', 'b'] }),
        formula({ actionKey: 'a*1|b*1', ingredientElementIds: ['a', 'b'] }),
      ],
    })
    const conteos = calcularPotencialPorElemento(s)
    assert.equal(conteos.get('a'), 1)
    assert.equal(conteos.get('b'), 1)
  })

  it('representaciones duplicadas de la misma acción: una sola', () => {
    const s = snapshot({
      discoveredElementIds: new Set(['a']),
      formulas: [
        formula({ actionKey: 'a*2', ingredientElementIds: ['a', 'a'], totalUnidades: 2 }),
        formula({ actionKey: 'a*2', ingredientElementIds: ['a'], totalUnidades: 2 }),
      ],
    })
    assert.equal(calcularPotencialPorElemento(s).get('a'), 1)
  })

  it('creación de avance legal y sin resolver: cuenta; ya resuelta: no', () => {
    const legal = snapshot({
      discoveredElementIds: new Set(['a', 'b']),
      formulas: [formula({ actionKey: 'a*1|b*1', ingredientElementIds: ['a', 'b'] })],
    })
    assert.equal(calcularPotencialPorElemento(legal).get('a'), 1)

    const resuelta = snapshot({
      discoveredElementIds: new Set(['a', 'b']),
      resolvedInputKeys: new Set(['a*1|b*1']),
      formulas: [formula({ actionKey: 'a*1|b*1', ingredientElementIds: ['a', 'b'] })],
    })
    assert.equal(calcularPotencialPorElemento(resuelta).size, 0)
  })
})

// ---------------------------------------------------------------------------
// Potencial: aplicación de avances poseídos a su secuencia origen
// ---------------------------------------------------------------------------

describe('calcularPotencialPorElemento — aplicación de avances', () => {
  const base = () =>
    snapshot({
      discoveredElementIds: new Set(['origen']),
      aplicaciones: [
        aplicacion({ actionKey: 'advance-application:adv1', sourceElementId: 'origen', targetElementId: 'destino' }),
      ],
    })

  it('avance poseído, origen descubierto, destino sin descubrir y ritual satisfecho: el origen gana 1', () => {
    assert.equal(calcularPotencialPorElemento(base()).get('origen'), 1)
  })

  it('sin avance poseído: excluido', () => {
    const s = base()
    s.aplicaciones[0].owned = false
    assert.equal(calcularPotencialPorElemento(s).size, 0)
  })

  it('destino ya descubierto: excluido', () => {
    const s = base()
    s.discoveredElementIds.add('destino')
    assert.equal(calcularPotencialPorElemento(s).size, 0)
  })

  it('ritual requerido sin satisfacer: excluido', () => {
    const s = base()
    s.aplicaciones[0].ritualSatisfecho = false
    assert.equal(calcularPotencialPorElemento(s).size, 0)
  })

  it('avance inactivo: excluido', () => {
    const s = base()
    s.aplicaciones[0].advanceActivo = false
    assert.equal(calcularPotencialPorElemento(s).size, 0)
  })

  it('contenido inactivo (camino o elemento destino): excluido', () => {
    const s = base()
    s.aplicaciones[0].contenidoActivo = false
    assert.equal(calcularPotencialPorElemento(s).size, 0)
  })

  it('la misma aplicación duplicada cuenta una sola vez', () => {
    const s = base()
    s.aplicaciones.push({ ...s.aplicaciones[0] })
    assert.equal(calcularPotencialPorElemento(s).get('origen'), 1)
  })

  it('elementos sin acciones no aparecen en el mapa (el consumidor usa 0)', () => {
    const s = snapshot({ discoveredElementIds: new Set(['a', 'b', 'c']) })
    const conteos = calcularPotencialPorElemento(s)
    assert.equal(conteos.size, 0)
    assert.equal(conteos.get('c') ?? 0, 0)
  })
})

// ---------------------------------------------------------------------------
// Tiers de potencial
// ---------------------------------------------------------------------------

describe('potentialTierFromCount', () => {
  it('límites exactos', () => {
    assert.equal(potentialTierFromCount(0), 1)
    assert.equal(potentialTierFromCount(3), 1)
    assert.equal(potentialTierFromCount(4), 2)
    assert.equal(potentialTierFromCount(12), 2)
    assert.equal(potentialTierFromCount(13), 3)
    assert.equal(potentialTierFromCount(18), 3)
    assert.equal(potentialTierFromCount(19), 4)
    assert.equal(potentialTierFromCount(24), 4)
    assert.equal(potentialTierFromCount(25), 5)
    assert.equal(potentialTierFromCount(999999), 5)
  })

  it('valores inválidos se acotan al tier I', () => {
    assert.equal(potentialTierFromCount(-1), 1)
    assert.equal(potentialTierFromCount(Number.NaN), 1)
    assert.equal(potentialTierFromCount(Number.POSITIVE_INFINITY), 1)
  })

  it('los rangos públicos derivan de los mismos límites', () => {
    assert.equal(rangoDeTier(1), '0–3')
    assert.equal(rangoDeTier(2), '4–12')
    assert.equal(rangoDeTier(3), '13–18')
    assert.equal(rangoDeTier(4), '19–24')
    assert.equal(rangoDeTier(5), '25+')
  })
})

// ---------------------------------------------------------------------------
// Privacidad de las cargas públicas
// ---------------------------------------------------------------------------

describe('cargas públicas', () => {
  it('el resultado del Vidente solo expone elementId y el recuento exacto', () => {
    const r = resultadoVidentePublico('elem-1', 7)
    assert.deepEqual(Object.keys(r).sort(), ['availableCombinationCount', 'elementId'])
    assert.equal(r.availableCombinationCount, 7)
  })

  it('la entrada de potencial solo expone elementId y tier, nunca el recuento', () => {
    const r = entradaPotencialPublica('elem-1', 25)
    assert.deepEqual(Object.keys(r).sort(), ['elementId', 'tier'])
    assert.equal(r.tier, 5)
    assert.equal('count' in r, false)
    assert.equal('availableCombinationCount' in r, false)
    assert.equal('inputKey' in r, false)
  })
})
