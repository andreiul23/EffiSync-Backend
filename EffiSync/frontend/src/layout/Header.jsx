import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Header.scss';

function Header() {
  const { isLoggedIn, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHome = location.pathname === '/';
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

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
          <img src="/logo_alb.svg" alt="EffiSync Logo" className="header__logo-icon" />
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
              <Link to="/calendar" className="header__link">Calendar</Link>
              <Link to="/groups" className="header__link">Groups</Link>
              <Link to="/account" className="header__link">Account</Link>
              <button className="header__btn header__btn--ghost" onClick={logout}>
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
        <button
          className={`header__mobile-toggle ${mobileOpen ? 'header__mobile-toggle--open' : ''}`}
          aria-label="Menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="header__mobile-backdrop" onClick={() => setMobileOpen(false)} />
          <div className="header__mobile-drawer" role="dialog" aria-label="Navigation">
            {isLoggedIn ? (
              <>
                <Link to="/calendar" className="header__mobile-link">📅 Calendar</Link>
                <Link to="/groups" className="header__mobile-link">👥 Groups</Link>
                <Link to="/account" className="header__mobile-link">👤 Account</Link>
                <button
                  className="header__mobile-link header__mobile-link--danger"
                  onClick={() => { setMobileOpen(false); logout(); }}
                >
                  ↩ Log Out
                </button>
              </>
            ) : (
              <>
                {isHome && (
                  <>
                    <button
                      className="header__mobile-link"
                      onClick={() => handleScrollTo('product-section')}
                    >
                      Product
                    </button>
                    <button
                      className="header__mobile-link"
                      onClick={() => handleScrollTo('pricing-section')}
                    >
                      Pricing
                    </button>
                  </>
                )}
                <Link to="/login" className="header__mobile-link">Log In</Link>
                <Link to="/signup" className="header__mobile-link header__mobile-link--primary">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </header>
  );
}

export default Header;
