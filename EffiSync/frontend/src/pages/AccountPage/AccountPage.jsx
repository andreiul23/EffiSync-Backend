import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './AccountPage.scss';

function AccountPage() {
  const { user } = useAuth();

  const nameStr = user?.name || 'Alex Popescu';
  const nameParts = nameStr.split(' ');
  const initials = `${nameParts[0]?.[0] || ''}${nameParts[1]?.[0] || ''}`.toUpperCase() || 'AP';

  return (
    <div className="account-page">
      <div className="account-page__card">
        <div className="account-page__avatar">{initials}</div>
        <h1 className="account-page__name">{nameStr}</h1>
        <p className="account-page__email">{user?.email || 'alex.popescu@gmail.com'}</p>

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
