import { useEffect, useState } from 'react';
import { tasks as tasksApi } from '../../services/api';
import './MemberProfileModal.scss';

function MemberProfileModal({ isOpen, onClose, member, householdId, currentUserId }) {
  const [memberTasks, setMemberTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !member?.id || !householdId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Only show GROUP tasks here — the modal lives in the household view, so
    // a roommate's private/individual tasks are intentionally hidden.
    tasksApi
      .list({ userId: member.id, householdId, type: 'GROUP' })
      .then((data) => {
        if (cancelled) return;
        setMemberTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load schedule');
        setMemberTasks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, member?.id, householdId]);

  if (!isOpen || !member) return null;

  const initials = (member.name || member.email || '?')
    .split(/\s+|[._-]/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Tasks the member is currently committed to: anything not completed/rejected,
  // sorted by due date so judges immediately see "what's on their plate".
  const ACTIVE = new Set(['PENDING', 'IN_PROGRESS', 'AWAITING_REVIEW']);
  const activeTasks = memberTasks
    .filter((t) => ACTIVE.has(t.status))
    .sort((a, b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return ad - bd;
    });

  const formatWhen = (iso) => {
    if (!iso) return 'No due date';
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isSelf = currentUserId && member.id === currentUserId;

  return (
    <div className="member-profile__overlay" onClick={onClose}>
      <div className="member-profile" onClick={e => e.stopPropagation()}>
        <div className="member-profile__header">
          <h3>{isSelf ? 'Your Schedule' : `${member.name?.split(' ')[0] || 'Member'}'s Schedule`}</h3>
          <button className="member-profile__close" onClick={onClose}>×</button>
        </div>

        <div className="member-profile__info">
          <div className="member-profile__avatar">{initials}</div>
          <div className="member-profile__details">
            <span className="member-profile__name">{member.name || member.email}</span>
            {member.email && <span className="member-profile__role">{member.email}</span>}
          </div>
        </div>

        <div className="member-profile__schedule">
          <h4 className="member-profile__schedule-title">
            Busy Schedule {activeTasks.length > 0 && <span style={{ opacity: 0.6, fontWeight: 400 }}>({activeTasks.length})</span>}
          </h4>

          {loading && <p className="member-profile__empty">Loading schedule…</p>}
          {error && !loading && <p className="member-profile__empty">{error}</p>}

          {!loading && !error && activeTasks.length === 0 && (
            <p className="member-profile__empty">Nothing on the calendar — they're free!</p>
          )}

          {!loading && !error && activeTasks.length > 0 && (
            <div className="member-profile__schedule-list">
              {activeTasks.map((task) => (
                <div key={task.id} className="member-profile__schedule-item">
                  <span className="member-profile__schedule-day">{task.title}</span>
                  <span className="member-profile__schedule-time">
                    {formatWhen(task.dueDate)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MemberProfileModal;

