import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Header.scss';

function Header() {
  const { isLoggedIn, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isHome = location.pathname === '/';
  const isAuthPage =
    location.pathname === '/login' || location.pathname === '/signup';

  const handleScrollTo = (sectionId) => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLogoClick = (e) => {
    e.preventDefault();
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  };

  if (isAuthPage) return null;

  return (
    <header className="header">
      <nav className="header__nav">
        <a href="/" className="header__logo" onClick={handleLogoClick}>
          <img
            src="/logo_alb.png"
            alt="EffiSync Logo"
            className="header__logo-icon"
          />
          <span className="header__logo-text">EffiSync</span>
        </a>

        <div className="header__links">
          {isHome && !isLoggedIn && (
            <>
              <button
                className="header__link"
                onClick={() => handleScrollTo('product-section')}
              >
                Product
              </button>
              <button
                className="header__link"
                onClick={() => handleScrollTo('pricing-section')}
              >
                Pricing
              </button>
            </>
          )}

          {isLoggedIn ? (
            <>
              <Link to="/calendar" className="header__link">
                Calendar
              </Link>
              <Link to="/groups" className="header__link">
                Groups
              </Link>
              <Link to="/account" className="header__link">
                Account
              </Link>
              <button
                className="header__btn header__btn--ghost"
                onClick={logout}
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="header__btn header__btn--ghost">
                Log In
              </Link>
              <Link to="/signup" className="header__btn header__btn--primary">
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button className="header__mobile-toggle" aria-label="Menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>
    </header>
  );
}

export default Header;
