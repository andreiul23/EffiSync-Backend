import { Link } from 'react-router-dom';
import './GroupsSliderMenu.scss';

function GroupsSliderMenu({ isOpen, onClose, groups, onCreateGroup, onJoinGroup }) {
  return (
    <>
      {isOpen && <div className="slider-menu__backdrop" onClick={onClose} />}
      <div className={`slider-menu ${isOpen ? 'slider-menu--open' : ''}`}>
        <div className="slider-menu__header">
          <h3>Your Groups</h3>
          <button className="slider-menu__close" onClick={onClose}>×</button>
        </div>
        <div className="slider-menu__list">
          {groups.map(group => {
            const name = group?.name || 'Household';
            const initial = name.charAt(0).toUpperCase();
            const memberCount = Array.isArray(group?.members) ? group.members.length : 0;
            return (
              <Link to="/groups" key={group.id} className="slider-menu__group" onClick={onClose}>
                <div className="slider-menu__group-avatar">
                  {initial}
                </div>
                <div className="slider-menu__group-info">
                  <span className="slider-menu__group-name">{name}</span>
                  <span className="slider-menu__group-type">{group?.type || 'Household'}</span>
                </div>
                <span className="slider-menu__group-members">{memberCount} members</span>
              </Link>
            );
          })}
        </div>
        <div className="slider-menu__actions">
          <button className="slider-menu__btn slider-menu__btn--create" onClick={onCreateGroup}>
            <span>+</span> Create a new Group
          </button>
          <button className="slider-menu__btn slider-menu__btn--join" onClick={onJoinGroup}>
            Join a Group
          </button>
        </div>
      </div>
    </>
  );
}

export default GroupsSliderMenu;
