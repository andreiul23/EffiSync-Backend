import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../services/api';
import './AccountPage.scss';

function AccountPage() {
  const { user } = useAuth();

  const nameStr = user?.name || 'Alex Popescu';
  const nameParts = nameStr.split(' ');
  const initials = `${nameParts[0]?.[0] || ''}${nameParts[1]?.[0] || ''}`.toUpperCase() || 'AP';

  const isCalendarConnected = Boolean(user?.googleRefreshToken || user?.calendarConnected);

  const handleConnectGoogle = () => {
    window.location.href = auth.googleLoginUrl();
  };

  return (
    <div className="account-page">
      <div className="account-page__card">
        <div className="account-page__avatar">{initials}</div>
        <h1 className="account-page__name">{nameStr}</h1>
        <p className="account-page__email">{user?.email || 'alex.popescu@gmail.com'}</p>

        {/* Google Calendar integration */}
        <div className="account-page__section">
          <h3 className="account-page__section-title">Integrations</h3>
          <div className="account-page__integration">
            <div className="account-page__integration-info">
              <span className="account-page__integration-icon">📅</span>
              <div>
                <div className="account-page__integration-name">Google Calendar</div>
                <div className="account-page__integration-desc">
                  {isCalendarConnected
                    ? 'Two-way sync is active. Events stay in sync automatically.'
                    : 'Connect to import events and sync your tasks both ways.'}
                </div>
              </div>
            </div>
            {isCalendarConnected ? (
              <span className="account-page__integration-badge account-page__integration-badge--ok">
                ✓ Connected
              </span>
            ) : (
              <button
                className="account-page__integration-btn"
                onClick={handleConnectGoogle}
              >
                Connect Google Calendar
              </button>
            )}
          </div>
        </div>

        <div className="account-page__section">
          <h3 className="account-page__section-title">Usual Schedule</h3>
          <div className="account-page__schedule">
            {(user?.usualSchedule || []).map((item, i) => (
              <div key={i} className="account-page__schedule-item">
                <span className="account-page__schedule-day">{item.day}</span>
                <span className="account-page__schedule-time">{item.start} - {item.end}</span>
                <span className="account-page__schedule-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <Link to="/calendar" className="account-page__back">
          ← Back to Calendar
        </Link>
      </div>
    </div>
  );
}

export default AccountPage;
