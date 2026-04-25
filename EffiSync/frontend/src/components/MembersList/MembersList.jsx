import MemberCard from '../MemberCard/MemberCard';
import './MembersList.scss';

function MembersList({ members, onMemberClick }) {
  return (
    <div className="members-list">
      <h3 className="members-list__title">Members</h3>
      <div className="members-list__items">
        {members.map(member => (
          <MemberCard key={member.id} member={member} onClick={onMemberClick} />
        ))}
      </div>
    </div>
  );
}

export default MembersList;
