import './MemberCard.scss';

function MemberCard({ member, onClick }) {
  const initials = member.name.split(' ').map(n => n[0]).join('');

  return (
    <div className="member-card" onClick={() => onClick && onClick(member)} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="member-card__avatar">{initials}</div>
      <div className="member-card__info">
        <span className="member-card__name">{member.name}</span>
        <span className="member-card__role">{member.role}</span>
      </div>
    </div>
  );
}

export default MemberCard;
