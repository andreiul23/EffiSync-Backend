import { useState } from 'react';
import './JoinGroupModal.scss';

function JoinGroupModal({ isOpen, onClose, onJoin }) {
  const [code, setCode] = useState('');

  if (!isOpen) return null;

  const handleJoin = () => {
    if (!code.trim()) return;
    onJoin(code);
    setCode('');
    onClose();
  };

  return (
    <div className="join-modal__overlay" onClick={onClose}>
      <div className="join-modal" onClick={e => e.stopPropagation()}>
        <div className="join-modal__header">
          <h3>Join a Group</h3>
          <button className="join-modal__close" onClick={onClose}>×</button>
        </div>
        <p className="join-modal__desc">Enter the group code shared by a member.</p>
        <input className="join-modal__input" type="text" placeholder="e.g. ABCD-1234"
          value={code} onChange={e => setCode(e.target.value)} autoFocus />
        <div className="join-modal__actions">
          <button className="join-modal__btn join-modal__btn--ghost" onClick={onClose}>Cancel</button>
          <button className="join-modal__btn join-modal__btn--primary" onClick={handleJoin}>Join</button>
        </div>
      </div>
    </div>
  );
}

export default JoinGroupModal;
