import './InfoCard.scss';

function InfoCard({ feature, visual }) {
  return (
    <div className="info-card" key={feature?.id}>
      <div className="info-card__visual">
        {visual}
      </div>
      <div className="info-card__content">
        <span className="info-card__icon">{feature?.icon}</span>
        <h4 className="info-card__title">{feature?.title}</h4>
        <p className="info-card__subtitle">{feature?.subtitle}</p>
      </div>
    </div>
  );
}

export default InfoCard;
