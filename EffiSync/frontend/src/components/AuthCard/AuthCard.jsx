import './AuthCard.scss';

function AuthCard({ children, title, subtitle }) {
  return (
    <div className="auth-card">
      <div className="auth-card__header">
        <span className="auth-card__logo">
          <img src="/logo_alb.svg" alt="EffiSync Logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} /> 
          EffiSync
        </span>
        <h1 className="auth-card__title">{title}</h1>
        {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}
      </div>
      <div className="auth-card__body">
        {children}
      </div>
    </div>
  );
}

export default AuthCard;
