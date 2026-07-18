import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { facultadesDesdeSlugs } from '@/server/domain/habilidades'
import { PanelHabilidades } from './PanelHabilidades'

describe('PanelHabilidades — marcador Savant', () => {
  it('se oculta antes del descubrimiento y muestra un 0/5 completamente deshabilitado después', () => {
    let peticiones = 0
    const fetchOriginal = globalThis.fetch
    globalThis.fetch = (async () => {
      peticiones += 1
      throw new Error('No debería solicitar datos')
    }) as typeof fetch

    try {
      assert.equal(
        renderToStaticMarkup(
          createElement(PanelHabilidades, {
            abilitiesOverride: facultadesDesdeSlugs(new Set()),
          }),
        ),
        '',
      )

      const html = renderToStaticMarkup(
        createElement(PanelHabilidades, {
          abilitiesOverride: facultadesDesdeSlugs(new Set(['savant'])),
        }),
      )
      assert.match(html, /Archivo del Savant/)
      assert.match(html, /0\/5/)
      assert.match(html, /Guardar combinación/)
      assert.match(html, /disabled=""/)
      assert.match(html, /Facultad en desarrollo/)
      assert.equal(peticiones, 0)
    } finally {
      globalThis.fetch = fetchOriginal
    }
  })
})
