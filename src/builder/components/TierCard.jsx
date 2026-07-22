import React, { forwardRef } from 'react'
import { parseTierText } from '../tierText'

// Tierlist slide: one pathway per slide, with a compact identity summary and
// the remaining space reserved for explanation points.
const TierCard = forwardRef(function TierCard(
  { path, icon, sequence, sequenceName, rank, tier, text, footerText = '', backgroundImage = null },
  ref,
) {
  const points = parseTierText(text)
  const estimatedLines = points.reduce((total, point) => total + Math.max(1, Math.ceil(point.length / 44)), 0)
  const pointDensity = estimatedLines <= 5 ? ' sparse' : estimatedLines >= 11 ? ' dense' : ''
  const footerDensity = footerText.length <= 70 ? ' sparse' : footerText.length > 160 ? ' dense' : ''
  const cardStyle = {
    '--tier': tier.c,
    '--tier-deep': tier.d,
  }

  return (
    <article
      className="tier-card"
      id="card"
      ref={ref}
      style={cardStyle}
      aria-label={`${path}${sequence === null ? ' pathway' : ` sequence ${sequence} ${sequenceName}`}, tier ${rank}`}
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
      <div className="content tier-content">
        <header className="tier-summary">
          <div className="tier-iconwrap">
            <img
              className="tier-icon"
              src={icon}
              alt={`${path} pathway icon`}
              width="58"
              height="58"
            />
          </div>
          <div className="tier-identity">
            <span className="tier-pathlabel">Pathway</span>
            <p className="tier-path">{path}</p>
            {sequence !== null && (
              <p className="tier-sequence">Seq {sequence} · {sequenceName}</p>
            )}
          </div>
          <p className="tier-rankwrap">
            <span className="tier-ranklabel">Tier</span>
            <strong className="tier-rank">{rank}</strong>
          </p>
        </header>

        <div className="tier-body">
          <section
            className={'tier-text' + (points.length ? '' : ' empty') + pointDensity}
            aria-label="Explanation"
          >
            <p className="tier-text-label">Explanation</p>
            {points.length ? (
              <ul className="tier-points">
                {points.map((point, index) => <li key={index}>{point}</li>)}
              </ul>
            ) : (
              <p className="tier-empty">Add one explanation point per line in the panel.</p>
            )}
          </section>

          {footerText && (
            <p className={'tier-footer-text' + footerDensity}>{footerText}</p>
          )}
        </div>

        <div className="progress tier-progress" aria-hidden="true">
          <div className="ptrack">
            <span className="pfill" style={{ width: '100%', background: tier.c }} />
          </div>
        </div>
      </div>
    </article>
  )
})

export default TierCard
