import React, { forwardRef } from 'react'
import { parseSequenceReach } from '../sequencePips'
import { titleSizeClass } from '../titleFit'

const SEQUENCES = 10

// El kicker suele venir como "Authority · Seq 1→0": la parte previa al primer
// separador es la etiqueta del chip y el resto queda a la derecha, como en la
// ficha del diseño.
function splitKicker(kicker) {
  const [head, ...rest] = (kicker || '').split('·')
  return { chip: head.trim(), aside: rest.join('·').trim() }
}

function Section({ label, text, highlight }) {
  return (
    <div className={'breakdown-section' + (highlight ? ' breakdown-edge' : '')}>
      <span className="breakdown-label">{label}</span>
      <p className="breakdown-text">{text}</p>
    </div>
  )
}

const BreakdownCard = forwardRef(function BreakdownCard(
  { kicker, title, does, doesNot, edgeLabel, edgeText, backgroundImage = null },
  ref,
) {
  const { chip, aside } = splitKicker(kicker)
  const reach = parseSequenceReach(kicker)
  const textLength = (does || '').length + (doesNot || '').length + (edgeText || '').length
  const dense = (title || '').length > 20 || textLength > 260

  return (
    <article
      className={'ficha breakdown-card' + (dense ? ' dense' : '')}
      id="card"
      ref={ref}
      aria-label={`${title || 'Breakdown'} concept card`}
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
      {/* La cifra fantasma repite la secuencia con control completo. */}
      {reach && <div className="breakdown-ghost" aria-hidden="true">{reach.full}</div>}
      <div className="breakdown-content">
        <header className="breakdown-head">
          {chip && <span className="breakdown-chip">{chip}</span>}
          {aside && <span className="breakdown-aside">{aside}</span>}
        </header>
        <h2 className={`ficha-name breakdown-title ${titleSizeClass(title || 'Concept name')}`}>
          {title || 'Concept name'}
        </h2>
        <div className="breakdown-sections">
          <Section label="Does" text={does || 'What this does.'} />
          <Section label="Doesn't" text={doesNot || "What this doesn't do."} />
          <Section label={edgeLabel || 'Edge'} text={edgeText || 'The key nuance.'} highlight />
        </div>
        {reach && (
          <div className="breakdown-pips" aria-hidden="true">
            {Array.from({ length: SEQUENCES }, (_, i) => (
              <span
                className={
                  'breakdown-pip' +
                  (i === reach.full ? ' full' : i === reach.partial ? ' partial' : '')
                }
                key={i}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  )
})

export default BreakdownCard
