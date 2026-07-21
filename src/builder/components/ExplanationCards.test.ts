import assert from 'node:assert/strict'
import test from 'node:test'
import React, { type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TierExplanationCard from './TierExplanationCard.jsx'
import GeneralExplanationCard from './GeneralExplanationCard.jsx'
import FullImageCoverCard from './FullImageCoverCard.jsx'
import TierCard from './TierCard.jsx'

const TierExplanation = TierExplanationCard as ComponentType<Record<string, unknown>>
const GeneralExplanation = GeneralExplanationCard as ComponentType<Record<string, unknown>>
const FullImageCover = FullImageCoverCard as ComponentType<Record<string, unknown>>
const Tier = TierCard as ComponentType<Record<string, unknown>>

test('Tier Explanation muestra solo tier y descripción general', () => {
  const html = renderToStaticMarkup(React.createElement(TierExplanation, {
    rank: 'S',
    tier: { c: '#fff', d: '#333' },
    description: 'Versatilidad excepcional.',
    scope: 'All pathways',
    backgroundImage: '/tier-explanation-background.jpg',
  }))
  assert.match(html, />S</)
  assert.match(html, /Versatilidad excepcional/)
  assert.match(html, /All pathways/)
  assert.match(html, /tier-explanation-background\.jpg/)
  assert.doesNotMatch(html, /<img/)
})

test('General Explanation muestra título y descripción sin exigir pathway', () => {
  const html = renderToStaticMarkup(React.createElement(GeneralExplanation, {
    title: 'El mundo espiritual',
    description: 'Conecta lugares y criaturas.',
    scope: 'All pathways',
  }))
  assert.match(html, /El mundo espiritual/)
  assert.match(html, /Conecta lugares y criaturas/)
  assert.match(html, /All pathways/)
})

test('Full Image Cover muestra la imagen a cuerpo completo y el título al pie', () => {
  const html = renderToStaticMarkup(React.createElement(FullImageCover, {
    image: '/cover.jpg',
    title: 'The Fool Returns',
    onUploadImage: () => undefined,
  }))
  assert.match(html, /full-cover-image/)
  assert.match(html, /cover\.jpg/)
  assert.match(html, /full-cover-title[^>]*>The Fool Returns/)
})

test('Tier muestra una secuencia específica del pathway', () => {
  const html = renderToStaticMarkup(React.createElement(Tier, {
    path: 'Fool',
    icon: '/fool.png',
    sequence: 9,
    sequenceName: 'Seer',
    rank: 'A',
    tier: { c: '#fff', d: '#333' },
    text: 'Useful divination.',
    footerText: 'A powerful information specialist.',
    backgroundImage: '/background.jpg',
  }))
  assert.match(html, /Seq 9/)
  assert.match(html, /Seer/)
  assert.match(html, /A powerful information specialist/)
  assert.match(html, /background\.jpg/)
  assert.match(html, /tier-body/)
})
