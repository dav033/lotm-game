import React, { forwardRef } from 'react'

const GeneralExplanationCard = forwardRef(function GeneralExplanationCard(
  { title, description, scope, pathway = null, icon = null, backgroundImage = null, backgroundOpacity = 65 },
  ref,
) {
  const dense = title.length > 38 || description.length > 500
  // Una linea en blanco separa parrafos. Dentro de uno, los saltos sueltos se
  // conservan (white-space:pre-line), asi que una lista sigue viendose como tal.
  const paragraphs = (description || 'Add the explanation in the editor panel.')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  return (
    <article
      className={'explanation-card general-explanation-card' + (dense ? ' dense' : '')}
      id="card"
      ref={ref}
      style={{ '--background-opacity': backgroundOpacity / 100 }}
      aria-label={`${title || 'General explanation'} for ${scope}`}
    >
      {/* Solo cuando la explicacion es de un pathway concreto: si es general no
          hay simbolo ni fondo que mostrar. */}
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
      <div className="explanation-content general-explanation-content">
        {pathway && (
          <header className="general-explanation-pathway">
            {icon && (
              <img
                className="general-explanation-icon"
                src={icon}
                alt={`${pathway} pathway icon`}
                width="44"
                height="44"
              />
            )}
            <span className="general-explanation-pathname">{pathway}</span>
          </header>
        )}
        <h2 className="general-explanation-title">{title || 'Explanation title'}</h2>
        <div className="general-explanation-rule" aria-hidden="true" />
        <div className="general-explanation-body">
          {paragraphs.map((block, index) => (
            <p className="general-explanation-description" key={index}>{block}</p>
          ))}
        </div>
      </div>
    </article>
  )
})

export default GeneralExplanationCard
