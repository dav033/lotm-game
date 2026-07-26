import React, { forwardRef } from 'react'

const GeneralExplanationCard = forwardRef(function GeneralExplanationCard(
  { title, description, scope },
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
      aria-label={`${title || 'General explanation'} for ${scope}`}
    >
      <div className="frame" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="explanation-content general-explanation-content">
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
