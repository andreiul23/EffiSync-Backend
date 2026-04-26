import { useState } from 'react';
import './JoinGroupModal.scss';

function JoinGroupModal({ isOpen, onClose, onJoin }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      // Parent decides whether to close the modal (on success). We keep the
      // dialog open on failure so the user can fix the code instead of
      // having to reopen the modal and retype.
      await onJoin(trimmed);
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="join-modal__overlay" onClick={onClose}>
      <div className="join-modal" onClick={e => e.stopPropagation()}>
        <div className="join-modal__header">
          <h3>Join a Group</h3>
          <button className="join-modal__close" onClick={onClose}>×</button>
        </div>
        <p className="join-modal__desc">Enter the group code shared by a member.</p>
        <input
          className="join-modal__input"
          type="text"
          placeholder="e.g. ABCD-1234"
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
          autoFocus
          disabled={submitting}
        />
        <div className="join-modal__actions">
          <button className="join-modal__btn join-modal__btn--ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="join-modal__btn join-modal__btn--primary" onClick={handleJoin} disabled={submitting || !code.trim()}>
            {submitting ? 'Joining…' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinGroupModal;
