import React, { forwardRef } from 'react'
import { titleSizeClass } from '../titleFit'
import { useBackgroundDrop } from '../useBackgroundDrop'
import { colorWithAlpha } from './TarotMemberCard.jsx'

const CorruptionFileCard = forwardRef(function CorruptionFileCard(
  {
    variant = 'Warning', incident, caseLabel, explanation, reactionLabel, reaction,
    footerText, corruptionLevel = 'Severe', accentColor = '#d84a4a', image = null,
    backgroundOpacity = 45, onDropBackground,
  },
  ref,
) {
  const { dragging, dropProps } = useBackgroundDrop(onDropBackground)
  const mode = ['Warning', 'Evidence', 'Quote'].includes(variant) ? variant : 'Warning'
  const evidenceLayout = mode === 'Evidence' && (incident || '').length > 24 ? 'stacked' : 'columns'
  const accent = /^#[0-9a-f]{6}$/i.test(accentColor || '') ? accentColor : '#d84a4a'
  const style = {
    '--corruption': accent,
    '--corruption-12': colorWithAlpha(accent, 0.12),
    '--corruption-25': colorWithAlpha(accent, 0.25),
    '--corruption-55': colorWithAlpha(accent, 0.55),
    '--background-opacity': backgroundOpacity / 100,
  }

  return (
    <article
      className={`ficha corruption-file-card corruption-file-${mode.toLowerCase()} corruption-evidence-${evidenceLayout}${dragging ? ' dragover' : ''}`}
      id="card"
      ref={ref}
      style={style}
      aria-label={`${incident || 'Corruption incident'} file`}
      {...dropProps}
    >
      {image && <div className="corruption-file-image" style={{ backgroundImage: `url("${image}")` }} aria-hidden="true" />}
      <div className="corruption-file-veil" aria-hidden="true" />
      <div className="corruption-file-grid" aria-hidden="true" />

      <div className="corruption-file-content">
        <header className="corruption-file-head">
          <div>
            <span className="corruption-file-kicker">Archive of impossible incidents</span>
            <strong>CASE {String((incident || 'UNKNOWN').length * 73).padStart(4, '0')}</strong>
          </div>
          <span className="corruption-file-level">{corruptionLevel}</span>
        </header>

        {mode === 'Warning' && <div className="corruption-warning-mark" aria-hidden="true">!</div>}
        {mode === 'Evidence' && <span className="corruption-evidence-tag">EVIDENCE / DO NOT EXPLAIN TO NORMAL PEOPLE</span>}
        {mode === 'Quote' && <span className="corruption-quote-mark" aria-hidden="true">“</span>}

        <main className="corruption-file-main">
          <h2 className={`corruption-file-title ${titleSizeClass(incident || 'Unknown incident')}`}>
            {incident || 'Unknown incident'}
          </h2>

          <div className="corruption-file-panels">
            <section className="corruption-file-panel corruption-file-explanation">
              <span>{caseLabel || 'Normal explanation'}</span>
              <p>{explanation || 'A perfectly reasonable explanation should appear here.'}</p>
            </section>
            <section className="corruption-file-panel corruption-file-reaction">
              <span>{reactionLabel || 'Fandom reaction'}</span>
              <p>{reaction || 'The reasonable response was immediately abandoned.'}</p>
            </section>
          </div>
        </main>

        <footer className="corruption-file-footer">
          <span>{footerText || 'Exposure confirmed. Context permanently damaged.'}</span>
          <b>{mode.toUpperCase()} FILE</b>
        </footer>
      </div>
    </article>
  )
})

export default CorruptionFileCard
