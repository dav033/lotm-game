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
import PathwayCard from './PathwayCard.jsx'
import Panel from './Panel.jsx'
import { CardContentSchema, toBuilderCardState } from '../../cards/schema'

const TierExplanation = TierExplanationCard as ComponentType<Record<string, unknown>>
const GeneralExplanation = GeneralExplanationCard as ComponentType<Record<string, unknown>>
const PathwayExplanation = PathwayExplanationCard as ComponentType<Record<string, unknown>>
const Breakdown = BreakdownCard as ComponentType<Record<string, unknown>>
const Map_ = MapCard as ComponentType<Record<string, unknown>>
const FullImageCover = FullImageCoverCard as ComponentType<Record<string, unknown>>
const Tier = TierCard as ComponentType<Record<string, unknown>>
const Pathway = PathwayCard as ComponentType<Record<string, unknown>>
const Panel_ = Panel as unknown as ComponentType<Record<string, unknown>>

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
  assert.match(html, /breakdown-chip[^"]*">Authority</)
  assert.match(html, /breakdown-title[^"]*">Replication</)
  assert.match(html, /Recreates powers, scenes and instances it has understood\./)
  assert.match(html, /Copy the person\. Only the power\./)
  assert.match(html, /breakdown-edge">[\s\S]*?Edge[\s\S]*?Needs understanding, not storage\./)
})

test('Breakdown deriva los pips de la secuencia escrita en el kicker', () => {
  const conRango = renderToStaticMarkup(React.createElement(Breakdown, {
    kicker: 'Authority · Seq 1→0', title: 'Seals',
    does: 'a', doesNot: 'b', edgeLabel: 'Edge', edgeText: 'c',
  }))
  const sinSecuencia = renderToStaticMarkup(React.createElement(Breakdown, {
    kicker: 'Authority · From Bizarreness', title: 'Concealment',
    does: 'a', doesNot: 'b', edgeLabel: 'Edge', edgeText: 'c',
  }))

  // [ "] evita contar el contenedor .breakdown-pips como si fuera un pip.
  assert.equal((conRango.match(/breakdown-pip[ "]/g) ?? []).length, 10, 'una fila de 10 secuencias')
  assert.match(conRango, /breakdown-pip full/, 'Seq 0 con control completo')
  assert.match(conRango, /breakdown-pip partial/, 'Seq 1 con control parcial')
  assert.match(conRango, /breakdown-ghost[^>]*>0</, 'la cifra fantasma repite la secuencia')
  // Sin secuencia en el texto no hay nada que dibujar.
  assert.doesNotMatch(sinSecuencia, /breakdown-pip/)
  assert.doesNotMatch(sinSecuencia, /breakdown-ghost/)
})

test('Breakdown y Pathway Explanation pintan la imagen de fondo bajo su velo', () => {
  const breakdown = renderToStaticMarkup(React.createElement(Breakdown, {
    kicker: 'Authority', title: 'Seals', does: 'a', doesNot: 'b', edgeLabel: 'Edge', edgeText: 'c',
    backgroundImage: '/covers/seals.jpg',
  }))
  const explicacion = renderToStaticMarkup(React.createElement(PathwayExplanation, {
    pathway: 'Door', index: 2, total: 22, title: 'Un *gancho*.', description: 'Texto.',
    backgroundImage: '/covers/door.jpg',
  }))

  assert.match(breakdown, /tier-background[\s\S]*?covers\/seals\.jpg/)
  assert.match(breakdown, /tier-background-overlay/)
  assert.match(explicacion, /tier-background[\s\S]*?covers\/door\.jpg/)
  // Sin imagen no se emite ningun nodo de fondo.
  const pelado = renderToStaticMarkup(React.createElement(Breakdown, {
    kicker: 'Authority', title: 'Seals', does: 'a', doesNot: 'b', edgeLabel: 'Edge', edgeText: 'c',
  }))
  assert.doesNotMatch(pelado, /tier-background/)
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
  assert.match(html, /map-title[^"]*">Where the powers come from/)
  assert.match(html, /map-entry-tags">Door · Change · King of Space-Time/)
  assert.match(html, /map-entry-value">Door, Space, Seals, Alternate Worlds/)
  assert.match(html, /map-entry-value">Solo un valor/)
  assert.match(html, /map-footer-text">Three roots\. Seven powers\./)
})

test('Map sin footer no muestra la regla final ni fondo de pathway', () => {
  const html = renderToStaticMarkup(React.createElement(Map_, {
    title: 'Sin footer',
    entriesText: 'Tags -> Value',
  }))
  assert.doesNotMatch(html, /map-footer/)
  assert.doesNotMatch(html, /tier-background/)
})

test('Map con pathway toma su color y su fondo', () => {
  const html = renderToStaticMarkup(React.createElement(Map_, {
    title: 'Where the powers come from',
    entriesText: 'Door -> Replication',
    tier: { c: '#6a5acd', d: '#241c4a' },
    backgroundImage: '/backgrounds/door.jpg',
    backgroundOpacity: 45,
  }))
  assert.match(html, /--tier:#6a5acd/)
  assert.match(html, /--tier-deep:#241c4a/)
  assert.match(html, /tier-background[\s\S]*?backgrounds\/door\.jpg/)
  assert.match(html, /--background-opacity:0\.45/)
})

test('todas las familias de fondo usan el mismo porcentaje y el panel ofrece presets', () => {
  const common = { backgroundImage: '/background.jpg', backgroundOpacity: 45 }
  const cards = [
    React.createElement(Tier, {
      path: 'Fool', icon: '/fool.png', sequence: null, sequenceName: null,
      rank: 'S', tier: { c: '#fff', d: '#333' }, text: '', ...common,
    }),
    React.createElement(Pathway, {
      path: 'Door', icon: '/door.png', sequence: null, sequenceName: null,
      tier: { c: '#fff', d: '#333' }, text: '', ...common,
    }),
    React.createElement(TierExplanation, {
      rank: 'S', tier: { c: '#fff', d: '#333' }, description: 'Text', scope: 'All', ...common,
    }),
    React.createElement(GeneralExplanation, {
      title: 'Title', description: 'Text', scope: 'Door', pathway: 'Door', ...common,
    }),
    React.createElement(PathwayExplanation, {
      pathway: 'Door', index: 2, total: 22, title: 'Title', description: 'Text', ...common,
    }),
    React.createElement(Breakdown, {
      title: 'Door', does: 'a', doesNot: 'b', edgeLabel: 'Edge', edgeText: 'c', ...common,
    }),
    React.createElement(Map_, { title: 'Map', entriesText: 'Door -> Space', ...common }),
  ]
  const state = toBuilderCardState(CardContentSchema.parse({
    type: 'Map', title: 'The chain', entries: [{ tags: 'Means', value: 'Door' }],
    pathway: 'Door', backgroundOpacity: 45,
  }))
  const panel = renderToStaticMarkup(React.createElement(Panel_, {
    state,
    set: () => undefined,
    accent: { c: '#fff' },
    onUploadImage: () => undefined,
    onDownload: () => undefined,
    onGenerateTierBatch: () => undefined,
  }))

  for (const card of cards) {
    assert.match(renderToStaticMarkup(card), /--background-opacity:0\.45/)
  }
  assert.match(panel, /type="range"[^>]*value="45"/)
  for (const preset of ['Low', 'Medium', 'High', 'Very high']) {
    assert.match(panel, new RegExp(`aria-pressed="(?:true|false)"[^>]*>${preset}<`))
  }
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
