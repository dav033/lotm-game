import React, { forwardRef } from 'react'

function Section({ label, text, highlight }) {
  return (
    <div className={'breakdown-section' + (highlight ? ' breakdown-edge' : '')}>
      <span className="breakdown-label">{label}</span>
      <p className="breakdown-text">{text}</p>
    </div>
  )
}

const BreakdownCard = forwardRef(function BreakdownCard(
  { kicker, title, does, doesNot, edgeLabel, edgeText },
  ref,
) {
  const textLength = (does || '').length + (doesNot || '').length + (edgeText || '').length
  const dense = (title || '').length > 20 || textLength > 260

  return (
    <article
      className={'breakdown-card' + (dense ? ' dense' : '')}
      id="card"
      ref={ref}
      aria-label={`${title || 'Breakdown'} concept card`}
    >
      <div className="frame" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="breakdown-content">
        {kicker && <span className="breakdown-kicker">{kicker}</span>}
        <h2 className="breakdown-title">{title || 'Concept name'}</h2>
        <div className="breakdown-sections">
          <Section label="Does" text={does || 'What this does.'} />
          <Section label="Doesn't" text={doesNot || "What this doesn't do."} />
          <Section label={edgeLabel || 'Edge'} text={edgeText || 'The key nuance.'} highlight />
        </div>
      </div>
    </article>
  )
})

export default BreakdownCard
