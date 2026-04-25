import './MemberProfileModal.scss';

function MemberProfileModal({ isOpen, onClose, member }) {
  if (!isOpen || !member) return null;

  const initials = member.name.split(' ').map(n => n[0]).join('');

  return (
    <div className="member-profile__overlay" onClick={onClose}>
      <div className="member-profile" onClick={e => e.stopPropagation()}>
        <div className="member-profile__header">
          <h3>Member Schedule</h3>
          <button className="member-profile__close" onClick={onClose}>×</button>
        </div>

        <div className="member-profile__info">
          <div className="member-profile__avatar">{initials}</div>
          <div className="member-profile__details">
            <span className="member-profile__name">{member.name}</span>
            <span className="member-profile__role">{member.role}</span>
          </div>
        </div>

        <div className="member-profile__schedule">
          <h4 className="member-profile__schedule-title">Busy Schedule</h4>
          {member.busySchedule && member.busySchedule.length > 0 ? (
            <div className="member-profile__schedule-list">
              {member.busySchedule.map((slot, i) => (
                <div key={i} className="member-profile__schedule-item">
                  <span className="member-profile__schedule-day">{slot.day}</span>
                  <span className="member-profile__schedule-time">
                    {slot.start} - {slot.end}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="member-profile__empty">No busy schedule available</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default MemberProfileModal;
