import React, { forwardRef } from 'react'
import { titleSizeClass } from '../titleFit'
import { useBackgroundDrop } from '../useBackgroundDrop'

function colorWithAlpha(color, alpha) {
  const match = /^#([0-9a-f]{6})$/i.exec(color || '')
  if (!match) return color
  const value = Number.parseInt(match[1], 16)
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${alpha})`
}

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
  const incidentNumber = String((incident || 'UNKNOWN').length * 73).padStart(4, '0')
  const formatLabel = { Warning: 'Hazard poster', Evidence: 'Meme autopsy', Quote: 'Context collapse' }[mode]
  const accent = /^#[0-9a-f]{6}$/i.test(accentColor || '') ? accentColor : '#d84a4a'
  const imageVisibility = Math.max(0, Math.min(100, backgroundOpacity)) / 100
  const veilOpacity = Number((0.92 - imageVisibility * 0.72).toFixed(3))
  const style = {
    '--corruption': accent,
    '--corruption-12': colorWithAlpha(accent, 0.12),
    '--corruption-25': colorWithAlpha(accent, 0.25),
    '--corruption-55': colorWithAlpha(accent, 0.55),
    '--background-opacity': imageVisibility,
    '--background-veil': veilOpacity,
    '--corruption-veil': colorWithAlpha(accent, veilOpacity),
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
      <div className="corruption-file-index" aria-hidden="true">{incidentNumber}</div>
      <div className="corruption-file-tape" aria-hidden="true" />

      <div className="corruption-file-content">
        <header className="corruption-file-head">
          <div>
            <span className="corruption-file-kicker">LOTM context damage unit</span>
            <strong>INCIDENT / {incidentNumber}</strong>
          </div>
          <span className="corruption-file-level">{corruptionLevel} corruption</span>
        </header>

        {mode === 'Warning' && <div className="corruption-warning-mark" aria-hidden="true">!</div>}
        {mode === 'Evidence' && <span className="corruption-evidence-tag">MEME AUTOPSY / CONTEXT COMPROMISED</span>}
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
          <b>{formatLabel}</b>
        </footer>
      </div>
    </article>
  )
})

export default CorruptionFileCard
