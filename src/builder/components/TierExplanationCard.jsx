import React, { forwardRef } from 'react'

const TierExplanationCard = forwardRef(function TierExplanationCard(
  { rank, tier, description, scope, backgroundImage = null },
  ref,
) {
  const cardStyle = { '--tier': tier.c, '--tier-deep': tier.d }
  return (
    <article
      className="explanation-card tier-explanation-card"
      id="card"
      ref={ref}
      style={cardStyle}
      aria-label={`Tier ${rank} explanation for ${scope}`}
    >
      {backgroundImage && (
        <>
          <div
            className="tier-background"
            style={{ backgroundImage: `url("${backgroundImage}")` }}
            aria-hidden="true"
          />
          <div className="tier-background-overlay" aria-hidden="true" />
        </>
      )}
      <div className="frame" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="explanation-content tier-explanation-content">
        <p className="explanation-scope">{scope}</p>
        <strong className="explanation-tier">{rank}</strong>
        <div className="tier-explanation-rule" aria-hidden="true" />
        <p className="tier-explanation-description">
          {description || 'Add a short explanation for this tier.'}
        </p>
      </div>
    </article>
  )
})

export default TierExplanationCard
