import assert from 'node:assert/strict'
import test from 'node:test'
import React, { type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TierExplanationCard from './TierExplanationCard.jsx'
import GeneralExplanationCard from './GeneralExplanationCard.jsx'
import PathwayExplanationCard from './PathwayExplanationCard.jsx'
import BreakdownCard from './BreakdownCard.jsx'
import MapCard from './MapCard.jsx'
import FullImageCoverCard from './FullImageCoverCard.jsx'
import TierCard from './TierCard.jsx'

const TierExplanation = TierExplanationCard as ComponentType<Record<string, unknown>>
const GeneralExplanation = GeneralExplanationCard as ComponentType<Record<string, unknown>>
const PathwayExplanation = PathwayExplanationCard as ComponentType<Record<string, unknown>>
const Breakdown = BreakdownCard as ComponentType<Record<string, unknown>>
const Map_ = MapCard as ComponentType<Record<string, unknown>>
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

test('Pathway Explanation muestra el contador, el título con la palabra resaltada y la descripción', () => {
  const html = renderToStaticMarkup(React.createElement(PathwayExplanation, {
    pathway: 'Door',
    index: 2,
    total: 22,
    title: "Door isn't a *teleport* pathway.",
    description: "It's access and exclusion.",
  }))
  assert.match(html, />2 \/ 22 PATHWAYS</)
  assert.match(html, /pathway-explanation-highlight">teleport</)
  assert.match(html, /It&#x27;s access and exclusion\./)
  assert.doesNotMatch(html, /\*/)
})

test('Breakdown muestra el kicker, el título y las tres secciones con la etiqueta libre resaltada', () => {
  const html = renderToStaticMarkup(React.createElement(Breakdown, {
    kicker: 'Authority',
    title: 'Replication',
    does: 'Recreates powers, scenes and instances it has understood.',
    doesNot: 'Copy the person. Only the power.',
    edgeLabel: 'Edge',
    edgeText: 'Needs understanding, not storage.',
  }))
  assert.match(html, /breakdown-kicker">Authority</)
  assert.match(html, /breakdown-title">Replication</)
  assert.match(html, /Recreates powers, scenes and instances it has understood\./)
  assert.match(html, /Copy the person\. Only the power\./)
  assert.match(html, /breakdown-edge">[\s\S]*?Edge[\s\S]*?Needs understanding, not storage\./)
})

test('Breakdown sin kicker no reserva espacio para él', () => {
  const html = renderToStaticMarkup(React.createElement(Breakdown, {
    title: 'Door',
    does: 'Opens or closes access.',
    doesNot: 'Move you. It grants the passage.',
    edgeLabel: 'Caps at',
    edgeText: 'Sequence 0.',
  }))
  assert.doesNotMatch(html, /breakdown-kicker/)
  assert.match(html, /breakdown-edge">[\s\S]*?Caps at/)
})

test('Map muestra el título, las filas con y sin etiquetas, y el footer opcional', () => {
  const html = renderToStaticMarkup(React.createElement(Map_, {
    title: 'Where the powers come from',
    entriesText: 'Door · Change · King of Space-Time -> Door, Space, Seals, Alternate Worlds\nSolo un valor',
    footerText: 'Three roots. Seven powers.',
  }))
  assert.match(html, /map-title">Where the powers come from/)
  assert.match(html, /map-entry-tags">Door · Change · King of Space-Time/)
  assert.match(html, /map-entry-value">Door, Space, Seals, Alternate Worlds/)
  assert.match(html, /map-entry-value">Solo un valor/)
  assert.match(html, /map-footer-text">Three roots\. Seven powers\./)
})

test('Map sin footer no muestra la regla final', () => {
  const html = renderToStaticMarkup(React.createElement(Map_, {
    title: 'Sin footer',
    entriesText: 'Tags -> Value',
  }))
  assert.doesNotMatch(html, /map-footer/)
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
