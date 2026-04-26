import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { auth, calendar as calendarApi } from '../../services/api';
import './AccountPage.scss';

function AccountPage() {
  const { user } = useAuth();

  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'Your account';
  const initials = useMemo(() => {
    const source = (user?.name || user?.email || '').trim();
    if (!source) return '?';
    const parts = source.split(/\s+|[._-]/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || source[0].toUpperCase();
  }, [user?.name, user?.email]);

  const isCalendarConnected = Boolean(user?.googleRefreshToken || user?.calendarConnected);

  const [upcoming, setUpcoming] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [upcomingError, setUpcomingError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!isCalendarConnected) {
      setUpcoming([]);
      return;
    }
    setLoadingUpcoming(true);
    setUpcomingError(null);
    calendarApi.upcoming(3)
      .then((data) => {
        if (cancelled) return;
        setUpcoming(Array.isArray(data?.events) ? data.events : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setUpcomingError(err?.message || 'Failed to load calendar');
      })
      .finally(() => {
        if (!cancelled) setLoadingUpcoming(false);
      });
    return () => { cancelled = true; };
  }, [isCalendarConnected]);

  const handleConnectGoogle = () => {
    window.location.href = auth.googleLoginUrl();
  };

  const groupedByDay = useMemo(() => {
    const buckets = new Map();
    for (const ev of upcoming) {
      if (!ev.dueDate) continue;
      const d = new Date(ev.dueDate);
      const key = d.toDateString();
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(ev);
    }
    return Array.from(buckets.entries()).map(([key, items]) => ({
      key,
      label: new Date(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
      items,
    }));
  }, [upcoming]);

  return (
    <div className="account-page">
      <div className="account-page__card">
        <div className="account-page__avatar">{initials}</div>
        <h1 className="account-page__name">{displayName}</h1>
        {user?.email && <p className="account-page__email">{user.email}</p>}

        {/* Google Calendar integration — only show connect CTA when not linked */}
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

        {/* Next 3 days — only when calendar is connected */}
        {isCalendarConnected && (
          <div className="account-page__section">
            <h3 className="account-page__section-title">Next 3 days</h3>
            {loadingUpcoming && <p className="account-page__muted">Loading your calendar…</p>}
            {upcomingError && <p className="account-page__error">{upcomingError}</p>}
            {!loadingUpcoming && !upcomingError && groupedByDay.length === 0 && (
              <p className="account-page__muted">No events in the next 3 days. Enjoy the calm!</p>
            )}
            {!loadingUpcoming && !upcomingError && groupedByDay.length > 0 && (
              <div className="account-page__upcoming">
                {groupedByDay.map((day) => (
                  <div key={day.key} className="account-page__upcoming-day">
                    <div className="account-page__upcoming-date">{day.label}</div>
                    <ul className="account-page__upcoming-list">
                      {day.items.map((ev) => {
                        const start = new Date(ev.dueDate);
                        const time = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return (
                          <li key={ev.id} className="account-page__upcoming-item">
                            <span className="account-page__upcoming-time">{time}</span>
                            <span className="account-page__upcoming-title">{ev.title}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {Array.isArray(user?.usualSchedule) && user.usualSchedule.length > 0 && (
          <div className="account-page__section">
            <h3 className="account-page__section-title">Usual Schedule</h3>
            <div className="account-page__schedule">
              {user.usualSchedule.map((item, i) => (
                <div key={i} className="account-page__schedule-item">
                  <span className="account-page__schedule-day">{item.day}</span>
                  <span className="account-page__schedule-time">{item.start} - {item.end}</span>
                  <span className="account-page__schedule-label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link to="/calendar" className="account-page__back">
          ← Back to Calendar
        </Link>
      </div>
    </div>
  );
}

export default AccountPage;

