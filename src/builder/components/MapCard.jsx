import React, { forwardRef } from 'react'
import { parseMapEntries } from '../mapEntries'

const MapCard = forwardRef(function MapCard(
  { title, entriesText, footerText, tier = null, backgroundImage = null },
  ref,
) {
  const entries = parseMapEntries(entriesText || '')
  const dense = entries.length > 4 || entries.some((entry) => entry.value.length > 40)
  // Sin pathway la carta se queda con el dorado neutro del CSS.
  const cardStyle = tier ? { '--tier': tier.c, '--tier-deep': tier.d } : undefined

  return (
    <article
      className={'map-card' + (dense ? ' dense' : '')}
      id="card"
      ref={ref}
      style={cardStyle}
      aria-label={`${title || 'Map'} card`}
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
      <div className="map-content">
        <h2 className="map-title">{title || 'Map title'}</h2>
        <div className="map-rule" aria-hidden="true" />
        {entries.length ? (
          <div className="map-entries">
            {entries.map((entry, index) => (
              <div className="map-entry" key={index}>
                {entry.tags && <span className="map-entry-tags">{entry.tags}</span>}
                <p className="map-entry-value">{entry.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="map-empty">Add one row per line as "tags -&gt; value" in the editor panel.</p>
        )}
        {footerText && (
          <>
            <div className="map-footer-rule" aria-hidden="true" />
            <p className="map-footer-text">{footerText}</p>
          </>
        )}
      </div>
    </article>
  )
})

export default MapCard
