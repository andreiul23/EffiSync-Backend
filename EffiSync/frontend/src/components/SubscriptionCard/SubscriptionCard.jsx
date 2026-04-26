import { useNavigate } from 'react-router-dom';
import './SubscriptionCard.scss';

function SubscriptionCard({ plan }) {
  const { id, name, price, period, subtitle, features, featured, cta } = plan;
  const navigate = useNavigate();

  const handleClick = () => {
    if (id === 'enterprise') {
      window.location.href = 'mailto:sales@effisync.app?subject=Enterprise%20plan%20inquiry';
      return;
    }
    navigate(`/signup?plan=${id}`);
  };

  return (
    <div className={`sub-card ${featured ? 'sub-card--featured' : ''}`}>
      {featured && <div className="sub-card__badge">Most Popular</div>}
      <div className="sub-card__header">
        <h3 className="sub-card__name">{name}</h3>
        <div className="sub-card__price">
          <span className="sub-card__amount">{price}</span>
          {period && <span className="sub-card__period">{period}</span>}
        </div>
        {subtitle && <p className="sub-card__subtitle">{subtitle}</p>}
      </div>
      <ul className="sub-card__features">
        {features.map((feature, i) => (
          <li key={i} className="sub-card__feature">
            <span className="sub-card__check">✓</span>
            {feature}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleClick}
        className={`sub-card__btn ${featured ? 'sub-card__btn--primary' : ''}`}
      >
        {cta || (featured ? 'Get Started' : 'Choose Plan')}
      </button>
    </div>
  );
}

export default SubscriptionCard;
