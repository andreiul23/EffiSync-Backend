import './SubscriptionCard.scss';

function SubscriptionCard({ plan }) {
  const { name, price, period, features, featured } = plan;

  return (
    <div className={`sub-card ${featured ? 'sub-card--featured' : ''}`}>
      {featured && <div className="sub-card__badge">Most Popular</div>}
      <div className="sub-card__header">
        <h3 className="sub-card__name">{name}</h3>
        <div className="sub-card__price">
          <span className="sub-card__amount">{price}</span>
          {period && <span className="sub-card__period">{period}</span>}
        </div>
      </div>
      <ul className="sub-card__features">
        {features.map((feature, i) => (
          <li key={i} className="sub-card__feature">
            <span className="sub-card__check">✓</span>
            {feature}
          </li>
        ))}
      </ul>
      <button className={`sub-card__btn ${featured ? 'sub-card__btn--primary' : ''}`}>
        {featured ? 'Get Started' : 'Choose Plan'}
      </button>
    </div>
  );
}

export default SubscriptionCard;
