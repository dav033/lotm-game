import React, { forwardRef } from 'react'

const GeneralExplanationCard = forwardRef(function GeneralExplanationCard(
  { title, description, scope },
  ref,
) {
  const dense = title.length > 45 || description.length > 520
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
        <p className="general-explanation-description">
          {description || 'Add the explanation in the editor panel.'}
        </p>
      </div>
    </article>
  )
})

export default GeneralExplanationCard
