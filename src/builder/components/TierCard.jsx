import { forwardRef } from 'react'

// Tierlist slide: one pathway per slide — big icon, pathway name, the assigned
// rank letter (colors the whole card), and a free-text verdict block.
const TierCard = forwardRef(function TierCard({ path, icon, rank, tier, text }, ref) {
  const cardStyle = { '--tier': tier.c, '--tier-deep': tier.d }

  return (
    <div className="tier-card" id="card" ref={ref} style={cardStyle}>
      <div className="frame" />
      <div className="scanlines" />
      <div className="content tier-content">
        <div className="tier-head">
          <span className="tier-head-hl">TIERLIST</span> · THE 22 PATHWAYS
        </div>

        <div className="tier-hero">
          <div className="tier-iconwrap">
            <img className="tier-icon" src={icon} alt={path} />
          </div>
          <div className="tier-path">{path}</div>
        </div>

        <div className="tier-rankwrap">
          <div className="tier-ranklabel">TIER</div>
          <div className="tier-rank">{rank}</div>
        </div>

        <div className={'tier-text' + (text ? '' : ' empty')}>
          {text || 'Write your verdict in the panel →'}
        </div>

        <div className="progress">
          <div className="ptrack">
            <span className="pfill" style={{ width: '100%', background: tier.c }} />
          </div>
        </div>
      </div>
    </div>
  )
})

export default TierCard
