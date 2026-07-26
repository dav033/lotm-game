import React, { forwardRef } from 'react'

// El texto entre *asteriscos* se resalta en el color del tier; el resto queda
// en blanco. Mismo truco visto en la imagen de referencia: solo una palabra
// o frase clave lleva color.
function renderHighlightedTitle(title) {
  return title.split(/\*(.+?)\*/g).map((part, index) => (
    index % 2 === 1
      ? <span className="pathway-explanation-highlight" key={index}>{part}</span>
      : part
  ))
}

const PathwayExplanationCard = forwardRef(function PathwayExplanationCard(
  { pathway, index, total, title, description },
  ref,
) {
  const dense = (title || '').length > 40 || (description || '').length > 160

  return (
    <article
      className={'explanation-card pathway-explanation-card' + (dense ? ' dense' : '')}
      id="card"
      ref={ref}
      aria-label={`${pathway} pathway explanation`}
    >
      <div className="frame" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="explanation-content pathway-explanation-content">
        <span className="pathway-explanation-counter">{index} / {total} PATHWAYS</span>
        <h2 className="pathway-explanation-title">
          {renderHighlightedTitle(title || 'A title with a *highlighted* word.')}
        </h2>
        <div className="pathway-explanation-rule" aria-hidden="true" />
        <p className="pathway-explanation-description">
          {description || 'Add the explanation in the editor panel.'}
        </p>
      </div>
    </article>
  )
})

export default PathwayExplanationCard
