import React from 'react'
import Card from './components/Card.jsx'
import CoverCard from './components/CoverCard.jsx'
import FullImageCoverCard from './components/FullImageCoverCard.jsx'
import TierCard from './components/TierCard.jsx'
import PathwayCard from './components/PathwayCard.jsx'
import TierExplanationCard from './components/TierExplanationCard.jsx'
import GeneralExplanationCard from './components/GeneralExplanationCard.jsx'
import PathwayExplanationCard from './components/PathwayExplanationCard.jsx'
import BreakdownCard from './components/BreakdownCard.jsx'
import MapCard from './components/MapCard.jsx'
import TarotMemberCard from './components/TarotMemberCard.jsx'
import CorruptionFileCard from './components/CorruptionFileCard.jsx'
import { PATHWAYS, PATH_NAMES, PATHWAY_COLORS, TIER_RANKS, tarotMemberTheme, tierColor, powerTier } from './data/pathways.js'
import { PATHWAY_ICONS } from './data/pathwayIcons.js'
import { PATHWAY_BACKGROUNDS } from './data/pathwayBackgrounds.js'

// Vista de solo lectura: mismos componentes de carta que usa el builder
// interactivo, sin handlers de upload/drag y sin ref (no hay export a PNG acá).
// La usan /cartas/vivo y las miniaturas del filmstrip, que la pintan a escala en
// vez de capturar un bitmap: asi una carta se ve sin tener que abrirla y nunca
// queda desactualizada.
export default function LiveCardPreview({ state }) {
  const isCover = state.type === 'Cover'
  const isFullImageCover = state.type === 'Full Image Cover'
  const isTier = state.type === 'Tier'
  const isPathwayCard = state.type === 'Pathway'
  const isTierExplanation = state.type === 'Tier Explanation'
  const isGeneralExplanation = state.type === 'General Explanation'
  const isPathwayExplanation = state.type === 'Pathway Explanation'
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
        backgroundOpacity={state.backgroundOpacity}
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
        backgroundOpacity={state.backgroundOpacity}
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
        backgroundOpacity={state.backgroundOpacity}
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
        pathway={state.explanationPath}
        icon={state.explanationPath ? PATHWAY_ICONS[state.explanationPath] : null}
        backgroundImage={state.generalExplanationBackgroundImage
          || (state.explanationPath ? PATHWAY_BACKGROUNDS[state.explanationPath] ?? null : null)}
        backgroundOpacity={state.backgroundOpacity}
      />
    )
  }

  if (isPathwayExplanation) {
    const pathwayExplanationPath = PATHWAYS[state.pathwayExplanationPath] ? state.pathwayExplanationPath : 'Fool'
    return (
      <PathwayExplanationCard
        pathway={pathwayExplanationPath}
        index={PATH_NAMES.indexOf(pathwayExplanationPath) + 1}
        total={PATH_NAMES.length}
        title={state.pathwayExplanationTitle}
        description={state.pathwayExplanationText}
        backgroundImage={state.pathwayExplanationBackgroundImage
          || PATHWAY_BACKGROUNDS[pathwayExplanationPath]
          || null}
        backgroundOpacity={state.backgroundOpacity}
        tier={PATHWAY_COLORS[pathwayExplanationPath]}
      />
    )
  }

  if (state.type === 'Breakdown') {
    return (
      <BreakdownCard
        kicker={state.breakdownKicker}
        title={state.breakdownTitle}
        does={state.breakdownDoes}
        doesNot={state.breakdownDoesNot}
        edgeLabel={state.breakdownEdgeLabel}
        edgeText={state.breakdownEdgeText}
        backgroundImage={state.breakdownBackgroundImage}
        backgroundOpacity={state.backgroundOpacity}
      />
    )
  }

  if (state.type === 'Map') {
    const mapPathway = PATHWAYS[state.mapPathway] ? state.mapPathway : null
    return (
      <MapCard
        title={state.mapTitle}
        entriesText={state.mapEntriesText}
        footerText={state.mapFooterText}
        pathway={mapPathway}
        tier={mapPathway ? PATHWAY_COLORS[mapPathway] : null}
        backgroundImage={state.mapBackgroundImage
          || (mapPathway ? PATHWAY_BACKGROUNDS[mapPathway] ?? null : null)}
        backgroundOpacity={state.backgroundOpacity}
      />
    )
  }

  if (state.type === 'Tarot Member') {
    const pathway = PATHWAYS[state.tarotMemberPathway] ? state.tarotMemberPathway : null
    return (
      <TarotMemberCard
        variant={state.tarotMemberVariant}
        name={state.tarotMemberName}
        tarotTitle={state.tarotMemberTitle}
        description={state.tarotMemberDescription}
        detailLabel={state.tarotMemberDetailLabel}
        detailText={state.tarotMemberDetailText}
        footerText={state.tarotMemberFooterText}
        image={state.tarotMemberImage || (pathway ? PATHWAY_BACKGROUNDS[pathway] ?? null : null)}
        backgroundOpacity={state.backgroundOpacity}
        tier={tarotMemberTheme(pathway, state.tarotMemberAccentColor)}
      />
    )
  }

  if (state.type === 'Corruption File') {
    return (
      <CorruptionFileCard
        variant={state.corruptionVariant}
        incident={state.corruptionIncident}
        caseLabel={state.corruptionCaseLabel}
        explanation={state.corruptionExplanation}
        reactionLabel={state.corruptionReactionLabel}
        reaction={state.corruptionReaction}
        footerText={state.corruptionFooterText}
        corruptionLevel={state.corruptionLevel}
        accentColor={state.corruptionAccentColor}
        image={state.corruptionImage}
        backgroundOpacity={state.backgroundOpacity}
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
