import { Link } from 'react-router-dom';
import './Footer.scss';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <span className="footer__logo">
            <img src="/logo_alb.svg" alt="EffiSync Logo" style={{ width: '20px', height: '20px', objectFit: 'contain' }} /> 
            EffiSync
          </span>
          <p className="footer__tagline">Plan less. Achieve more.</p>
        </div>

        <div className="footer__links">
          <div className="footer__col">
            <h4 className="footer__col-title">Product</h4>
            <Link to="/" className="footer__link">Home</Link>
            <Link to="/calendar" className="footer__link">Calendar</Link>
            <Link to="/groups" className="footer__link">Groups</Link>
          </div>
          <div className="footer__col">
            <h4 className="footer__col-title">Account</h4>
            <Link to="/login" className="footer__link">Log In</Link>
            <Link to="/signup" className="footer__link">Sign Up</Link>
            <Link to="/account" className="footer__link">Settings</Link>
          </div>
          <div className="footer__col">
            <h4 className="footer__col-title">Legal</h4>
            <span className="footer__link">Privacy Policy</span>
            <span className="footer__link">Terms of Service</span>
            <span className="footer__link">Contact</span>
          </div>
        </div>

        <div className="footer__bottom">
          <p>&copy; {new Date().getFullYear()} EffiSync. Built for the future of productivity.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
