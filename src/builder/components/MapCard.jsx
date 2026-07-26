import React, { forwardRef } from 'react'
import { parseMapEntries } from '../mapEntries'
import { titleSizeClass } from '../titleFit'
import { useBackgroundDrop } from '../useBackgroundDrop'

const MapCard = forwardRef(function MapCard(
  { title, entriesText, footerText, pathway = null, tier = null, backgroundImage = null, backgroundOpacity = 65, onDropBackground },
  ref,
) {
  const { dragging, dropProps } = useBackgroundDrop(onDropBackground)
  const entries = parseMapEntries(entriesText || '')
  const dense = entries.length > 3 || entries.some((entry) => entry.value.length > 44)
  // Sin pathway la ficha se queda con el dorado que trae .ficha por defecto.
  const cardStyle = {
    ...(tier ? { '--tier': tier.c, '--tier-deep': tier.d } : {}),
    '--background-opacity': backgroundOpacity / 100,
  }

  return (
    <article
      className={'ficha map-card' + (dense ? ' dense' : '') + (dragging ? ' dragover' : '')}
      id="card"
      ref={ref}
      style={cardStyle}
      aria-label={`${title || 'Map'} card`}
      {...dropProps}
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
      <div className="map-content">
        {pathway && <span className="map-chip">{pathway}</span>}
        <h2 className={`ficha-name map-title ${titleSizeClass(title || 'Map title')}`}>
          {title || 'Map title'}
        </h2>
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
        {footerText && <p className="map-footer-text">{footerText}</p>}
      </div>
    </article>
  )
})

export default MapCard
