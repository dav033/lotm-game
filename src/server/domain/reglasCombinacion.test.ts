import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  aplicacionAvanceTieneContenidoActivo,
  avanceCreableAhora,
  decidirAplicacionRitual,
  ritualesPermitenAplicacion,
  salidaRecetaEjecutable,
} from './reglasCombinacion'

describe('reglas compartidas de combinación', () => {
  it('una salida activa sin avance protector es ejecutable', () => {
    assert.equal(
      salidaRecetaEjecutable({ element: { isActive: true, sequence: null } }),
      true,
    )
    assert.equal(
      salidaRecetaEjecutable({
        element: { isActive: true, sequence: { advancesTo: [{ id: 'advance' }] } },
      }),
      false,
    )
  })

  it('la creación de avance exige avance y ambos caminos activos', () => {
    const base = {
      isActive: true,
      sourceSequence: { pathway: { isActive: true } },
      targetSequence: { pathway: { isActive: true } },
    }
    assert.equal(avanceCreableAhora(base), true)
    assert.equal(avanceCreableAhora({ ...base, isActive: false }), false)
  })

  it('la aplicación exige la secuencia origen exacta y contenido activo', () => {
    const base = {
      isActive: true,
      sourceSequence: { elementId: 'source', pathway: { isActive: true } },
      targetSequence: {
        element: { isActive: true },
        pathway: { isActive: true },
      },
    }
    assert.equal(aplicacionAvanceTieneContenidoActivo(base, 'source'), true)
    assert.equal(aplicacionAvanceTieneContenidoActivo(base, 'otra'), false)
  })

  it('sin rituales activos permite; con alternativas basta una preparada', () => {
    assert.equal(ritualesPermitenAplicacion([]), true)
    assert.equal(
      ritualesPermitenAplicacion([{ isActive: true, preparado: false }]),
      false,
    )
    assert.equal(
      ritualesPermitenAplicacion([
        { isActive: true, preparado: false },
        { isActive: true, preparado: true },
      ]),
      true,
    )
    assert.equal(
      ritualesPermitenAplicacion([{ isActive: false, preparado: false }]),
      true,
    )
  })

  it('separa desconocimiento, preparación y riesgo confirmado sin saltarse protección', () => {
    const unprepared = [{ isActive: true, preparado: false }]
    assert.equal(decidirAplicacionRitual(unprepared, false, false), 'KNOWLEDGE_REQUIRED')
    assert.equal(decidirAplicacionRitual(unprepared, false, true), 'KNOWLEDGE_REQUIRED')
    assert.equal(decidirAplicacionRitual(unprepared, true, false), 'PREPARATION_REQUIRED')
    assert.equal(
      decidirAplicacionRitual(unprepared, true, true),
      'CONFIRMED_UNPROTECTED_FAILURE',
    )
    assert.equal(
      decidirAplicacionRitual(
        [
          { isActive: true, preparado: false },
          { isActive: true, preparado: true },
        ],
        true,
        false,
      ),
      'ALLOW',
    )
  })
})
