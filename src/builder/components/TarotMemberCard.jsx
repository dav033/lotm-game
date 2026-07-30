import React, { forwardRef } from 'react'
import { titleSizeClass } from '../titleFit'
import { useBackgroundDrop } from '../useBackgroundDrop'

const TarotMemberCard = forwardRef(function TarotMemberCard(
  {
    variant = 'Portrait', name, tarotTitle, description, detailLabel, detailText,
    footerText, image = null, backgroundOpacity = 65, tier = null, onDropBackground,
  },
  ref,
) {
  const { dragging, dropProps } = useBackgroundDrop(onDropBackground)
  const mode = ['Portrait', 'Dossier', 'Contrast'].includes(variant) ? variant : 'Portrait'
  const style = {
    ...(tier ? { '--tier': tier.c, '--tier-deep': tier.d } : {}),
    '--background-opacity': backgroundOpacity / 100,
  }

  return (
    <article
      className={`ficha tarot-member-card tarot-member-${mode.toLowerCase()}${dragging ? ' dragover' : ''}`}
      id="card"
      ref={ref}
      style={style}
      aria-label={`${name || 'Tarot member'} profile`}
      {...dropProps}
    >
      {image && <div className="tarot-member-image" style={{ backgroundImage: `url("${image}")` }} aria-hidden="true" />}
      <div className="tarot-member-veil" aria-hidden="true" />
      <div className="tarot-member-arcana" aria-hidden="true">{tarotTitle || 'Unknown'}</div>

      <div className="tarot-member-content">
        <header className="tarot-member-head">
          <span className="tarot-member-chip">Tarot Club</span>
          <span className="tarot-member-mode">{mode}</span>
        </header>

        {mode === 'Dossier' && <span className="tarot-member-stamp">Restricted</span>}

        <div className="tarot-member-title-block">
          <p className="tarot-member-tarot">{tarotTitle || 'Tarot title'}</p>
          <h2 className={`ficha-name tarot-member-name ${titleSizeClass(name || 'Member name')}`}>{name || 'Member name'}</h2>
        </div>

        {mode === 'Contrast' ? (
          <div className="tarot-member-contrast-grid">
            <section>
              <span className="tarot-member-label">What the Club sees</span>
              <p>{description || 'The public impression.'}</p>
            </section>
            <section>
              <span className="tarot-member-label">{detailLabel || 'What is actually happening'}</span>
              <p>{detailText || 'The truth behind the performance.'}</p>
            </section>
          </div>
        ) : (
          <div className="tarot-member-copy">
            <p className="tarot-member-description">{description || 'A concise, accurate character description.'}</p>
            {detailText && (
              <div className="tarot-member-detail">
                <span className="tarot-member-label">{detailLabel || 'Club function'}</span>
                <p>{detailText}</p>
              </div>
            )}
          </div>
        )}

        {footerText && <p className="tarot-member-footer">{footerText}</p>}
      </div>
    </article>
  )
})

export default TarotMemberCard
