import React, { forwardRef } from 'react'
import { titleSizeClass } from '../titleFit'

// El texto entre *asteriscos* se resalta en el color del tier; el resto queda
// en blanco. Solo una palabra o frase clave lleva color.
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
  const shown = title || 'A title with a *highlighted* word.'
  // La talla se mide sobre el texto ya sin asteriscos: son marcas, no letras.
  const size = titleSizeClass(shown.replace(/\*/g, ''))

  return (
    <article
      className="ficha pathway-explanation-card"
      id="card"
      ref={ref}
      aria-label={`${pathway} pathway explanation`}
    >
      <div className="pathway-explanation-content">
        <header className="pathway-explanation-head">
          <span className="pathway-explanation-chip">{pathway}</span>
          <span className="pathway-explanation-counter">{index} / {total} PATHWAYS</span>
        </header>
        <h2 className={`ficha-name pathway-explanation-title ${size}`}>
          {renderHighlightedTitle(shown)}
        </h2>
        <p className="pathway-explanation-description">
          {description || 'Add the explanation in the editor panel.'}
        </p>
        <div className="pathway-explanation-rule" aria-hidden="true" />
      </div>
    </article>
  )
})

export default PathwayExplanationCard
