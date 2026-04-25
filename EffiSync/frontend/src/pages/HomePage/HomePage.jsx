import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import HeroBackground from '../../components/HeroBackground/HeroBackground';
import GradientText from '../../components/GradientText/GradientText';
import ColorBends from '../../components/ColorBends/ColorBends';
import StickyScroll from '../../components/StickyScroll/StickyScroll';
import SubscriptionCard from '../../components/SubscriptionCard/SubscriptionCard';
import { productFeatures, subscriptionPlans } from '../../mockData';
import './HomePage.scss';

function HomePage() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="home__hero">
        <HeroBackground />
        <div className="home__hero-content">
          <GradientText
            className="home__gradient-title"
            colors={['#904399', '#F9C7FF', '#B44BC7', '#5D0E66']}
            animationSpeed={6}
          >
            <h1 className="home__title">
              Your time deserves more than just a to-do list
            </h1>
          </GradientText>
          <p className="home__subtitle">Plan less. Achieve more.</p>
          <div className="home__hero-actions">
            <Link
              to={isLoggedIn ? '/calendar' : '/signup'}
              className="home__hero-btn home__hero-btn--primary"
            >
              {isLoggedIn ? 'Open Calendar' : 'Get Started Free'}
            </Link>
            <button
              className="home__hero-btn home__hero-btn--ghost"
              onClick={() => {
                document.getElementById('product-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Learn More ↓
            </button>
          </div>
        </div>
        <div className="home__hero-colorbends">
          <ColorBends
            colors={['#904399', '#5D0E66', '#F9C7FF']}
            speed={0.15}
            intensity={1.2}
            frequency={0.8}
            scale={1.2}
            noise={0.1}
            transparent={true}
            bandWidth={5}
          />
        </div>
        <div className="home__hero-scroll-indicator">
          <div className="home__scroll-dot"></div>
        </div>
      </section>

      {/* Product / Features Section */}
      <section className="home__product" id="product-section">
        <div className="home__product-header">
          <span className="home__product-tag">Why EffiSync?</span>
          <h2 className="home__section-title">
            A calendar that doesn't just show your time —<br />
            <span className="home__highlight">it helps you use it better.</span>
          </h2>
          <p className="home__section-desc">
            EffiSync combines intelligent scheduling, group coordination, and AI-powered insights
            to transform how you manage every hour of your day.
          </p>
        </div>
        <StickyScroll features={productFeatures} />
      </section>

      {/* Hook / Presentation Section */}
      <section className="home__hook">
        <div className="home__hook-inner">
          <div className="home__hook-glow"></div>
          <span className="home__hook-tag">Built for the way you work</span>
          <h2 className="home__hook-title">
            Stop juggling apps.<br />
            Start <span className="home__highlight">syncing your life.</span>
          </h2>
          <p className="home__hook-text">
            Most calendars show you when things happen. EffiSync shows you what's missing,
            what's colliding, and what you should do next. Whether you're managing a household,
            leading a team, or just trying to find time for yourself — EffiSync has your back.
          </p>
          <div className="home__hook-stats">
            <div className="home__stat">
              <span className="home__stat-num">3.2h</span>
              <span className="home__stat-label">saved per week on average</span>
            </div>
            <div className="home__stat">
              <span className="home__stat-num">94%</span>
              <span className="home__stat-label">fewer schedule conflicts</span>
            </div>
            <div className="home__stat">
              <span className="home__stat-num">2.5x</span>
              <span className="home__stat-label">better work-life balance score</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="home__pricing" id="pricing-section">
        <div className="home__pricing-header">
          <span className="home__product-tag">Pricing</span>
          <h2 className="home__section-title">Subscriptions</h2>
          <p className="home__section-desc">
            Choose the plan that fits your productivity needs. Upgrade or downgrade anytime.
          </p>
        </div>
        <div className="home__pricing-grid">
          {subscriptionPlans.map((plan) => (
            <SubscriptionCard key={plan.id} plan={plan} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default HomePage;
