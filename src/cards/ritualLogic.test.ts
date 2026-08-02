import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import RitualLogicCard from '../builder/components/RitualLogicCard.jsx'
import { CardContentSchema, fromBuilderCardState, toBuilderCardState } from './schema'

const RitualLogic = RitualLogicCard as unknown as ComponentType<Record<string, unknown>>

const ritual = {
  type: 'Ritual Logic' as const,
  pathway: 'Fool',
  sequence: 5,
  sequenceName: 'Marionettist',
  ritual: 'Drink the potion while listening to a mermaid sing.',
  survival: 'The song helps preserve thought and emotion while the potion attacks the aspirant’s Spirit Body Threads.',
  preparation: 'It rehearses influencing Spirit Body Threads without surrendering the self that will control them.',
  certainty: 'Mixed' as const,
  uncertainty: 'The emotional counter-resonance is a reading of the scene, not a named rule.',
  footerText: 'Learn the strings without becoming one.',
  backgroundOpacity: 45,
}

test('Ritual Logic valida y conserva su cadena causal al editarse', () => {
  const parsed = CardContentSchema.parse(ritual)
  const roundTrip = fromBuilderCardState(toBuilderCardState(parsed))
  assert.deepEqual(roundTrip, parsed)
})

test('Ritual Logic muestra ritual, peligro, preparacion y limite de evidencia', () => {
  const html = renderToStaticMarkup(React.createElement(RitualLogic, {
    pathway: ritual.pathway,
    sequence: ritual.sequence,
    sequenceName: ritual.sequenceName,
    ritual: ritual.ritual,
    survival: ritual.survival,
    preparation: ritual.preparation,
    certainty: ritual.certainty,
    uncertainty: ritual.uncertainty,
    footerText: ritual.footerText,
    tier: { c: '#d9b869' },
  }))

  assert.match(html, /Advancement ritual/)
  assert.match(html, /Potion hazard/)
  assert.match(html, /Concept rehearsal/)
  assert.match(html, /Mixed/)
  assert.match(html, /not a named rule/)
})
