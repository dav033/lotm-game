import React from 'react'
import Card from './components/Card.jsx'
import CoverCard from './components/CoverCard.jsx'
import FullImageCoverCard from './components/FullImageCoverCard.jsx'
import TierCard from './components/TierCard.jsx'
import PathwayCard from './components/PathwayCard.jsx'
import TierExplanationCard from './components/TierExplanationCard.jsx'
import GeneralExplanationCard from './components/GeneralExplanationCard.jsx'
import { PATHWAYS, PATHWAY_COLORS, TIER_RANKS, tierColor, powerTier } from './data/pathways.js'
import { PATHWAY_ICONS } from './data/pathwayIcons.js'
import { PATHWAY_BACKGROUNDS } from './data/pathwayBackgrounds.js'
import { toBuilderCardState } from '../cards/schema'

// Vista de solo lectura para /cartas/vivo: mismos componentes de carta que usa
// el builder interactivo, sin handlers de upload/drag y sin ref (no hay export a PNG acá).
export default function LiveCardPreview({ content }) {
  const state = toBuilderCardState(content)
  const isCover = state.type === 'Cover'
  const isFullImageCover = state.type === 'Full Image Cover'
  const isTier = state.type === 'Tier'
  const isPathwayCard = state.type === 'Pathway'
  const isTierExplanation = state.type === 'Tier Explanation'
  const isGeneralExplanation = state.type === 'General Explanation'
  const isCharacter = state.type === 'Character'

  if (isCover) {
    return (
      <CoverCard
        image1={state.coverImage1}
        image2={state.coverImage2}
        title={state.coverTitle}
        part={state.coverPartNum}
        onUploadImage={() => undefined}
      />
    )
  }

  if (isFullImageCover) {
    return (
      <FullImageCoverCard
        image={state.fullCoverImage}
        title={state.fullCoverTitle}
        onUploadImage={() => undefined}
      />
    )
  }

  if (isTier) {
    const tierBackgroundImage = state.tierBackgroundImage || PATHWAY_BACKGROUNDS[state.tierPath] || null
    return (
      <TierCard
        path={state.tierPath}
        icon={PATHWAY_ICONS[state.tierPath]}
        sequence={state.tierSeq}
        sequenceName={state.tierSeq === null ? null : PATHWAYS[state.tierPath][9 - state.tierSeq]}
        rank={state.tierRank}
        tier={TIER_RANKS[state.tierRank]}
        text={state.tierText}
        footerText={state.tierFooterText}
        backgroundImage={tierBackgroundImage}
      />
    )
  }

  if (isPathwayCard) {
    const pathwayCardBackgroundImage = state.pathwayCardBackgroundImage || PATHWAY_BACKGROUNDS[state.pathwayCardPath] || null
    return (
      <PathwayCard
        path={state.pathwayCardPath}
        icon={PATHWAY_ICONS[state.pathwayCardPath]}
        sequence={state.pathwayCardSeq}
        sequenceName={state.pathwayCardSeq === null ? null : PATHWAYS[state.pathwayCardPath][9 - state.pathwayCardSeq]}
        tier={PATHWAY_COLORS[state.pathwayCardPath]}
        text={state.pathwayCardText}
        footerText={state.pathwayCardFooterText}
        backgroundImage={pathwayCardBackgroundImage}
      />
    )
  }

  if (isTierExplanation) {
    return (
      <TierExplanationCard
        rank={state.tierRank}
        tier={TIER_RANKS[state.tierRank]}
        description={state.tierExplanationText}
        backgroundImage={state.tierExplanationBackgroundImage}
        scope={state.explanationPath ?? 'All pathways'}
      />
    )
  }

  if (isGeneralExplanation) {
    return (
      <GeneralExplanationCard
        title={state.generalExplanationTitle}
        description={state.generalExplanationText}
        scope={state.explanationPath ?? 'All pathways'}
      />
    )
  }

  const rawSequences = [
    { path: state.path, seq: state.seq },
    ...(state.hasSecond ? [{ path: state.path2, seq: state.seq2 }] : []),
  ]
  const sequences = rawSequences.map(({ path, seq }) => ({
    path,
    seq,
    rank: PATHWAYS[path][9 - seq],
    icon: PATHWAY_ICONS[path],
    tier: tierColor(seq),
  }))
  const accent = powerTier(state.type, state.power, state.grade)
  const baseValue = isCharacter ? state.power : state.grade
  const powerValue = baseValue + (state.mod.trim() ? ` (${state.mod.trim()})` : '')
  const pathLabel = [...new Set(sequences.map((s) => s.path))].join(' · ')

  return (
    <Card
      name={state.name}
      image={state.image}
      accent={accent}
      sequences={sequences}
      pathLabel={pathLabel}
      dom={state.dom}
      powerLabel={isCharacter ? 'Power' : 'Grade'}
      powerValue={powerValue}
      onUploadImage={() => undefined}
      onDropImages={() => undefined}
    />
  )
}
