import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './JoinHousehold.scss';

/**
 * Shown when user.householdId === null.
 * Lets users create a new household or join one via invite code.
 */
function JoinHousehold() {
  const { user, login } = useAuth();
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!householdName.trim()) { setError('Household name is required'); return; }
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: householdName, createdById: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create household');
      login({ ...user, householdId: data.household.id });
      try {
        await fetch('http://localhost:3000/api/calendar/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('effisync_jwt') || localStorage.getItem('token')}`
          },
          body: JSON.stringify({})
        });
      } catch (e) {
        console.error('Post-join sync failed', e);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) { setError('Invite code is required'); return; }
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/households/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim(), userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid invite code');
      login({ ...user, householdId: data.householdId });
      try {
        await fetch('http://localhost:3000/api/calendar/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('effisync_jwt') || localStorage.getItem('token')}`
          },
          body: JSON.stringify({})
        });
      } catch (e) {
        console.error('Post-join sync failed', e);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-household">
      <div className="join-household__card">
        <div className="join-household__icon">🏠</div>
        <h2 className="join-household__title">Welcome to EffiSync!</h2>
        <p className="join-household__subtitle">
          You're not part of any household yet. Create one or join an existing one to get started.
        </p>

        {!mode && (
          <div className="join-household__actions">
            <button className="join-household__btn join-household__btn--primary" onClick={() => setMode('create')}>
              ✨ Create Household
            </button>
            <button className="join-household__btn join-household__btn--secondary" onClick={() => setMode('join')}>
              🔗 Join with Invite Code
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form className="join-household__form" onSubmit={handleCreate}>
            <input
              className="join-household__input"
              type="text"
              placeholder="Household name (e.g. Casa Popescu)"
              value={householdName}
              onChange={(e) => { setHouseholdName(e.target.value); setError(''); }}
              autoFocus
            />
            {error && <span className="join-household__error">{error}</span>}
            <div className="join-household__form-actions">
              <button type="button" className="join-household__btn join-household__btn--ghost" onClick={() => { setMode(null); setError(''); }}>← Back</button>
              <button type="submit" className="join-household__btn join-household__btn--primary" disabled={loading}>
                {loading ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form className="join-household__form" onSubmit={handleJoin}>
            <input
              className="join-household__input"
              type="text"
              placeholder="Enter invite code"
              value={inviteCode}
              onChange={(e) => { setInviteCode(e.target.value); setError(''); }}
              autoFocus
            />
            {error && <span className="join-household__error">{error}</span>}
            <div className="join-household__form-actions">
              <button type="button" className="join-household__btn join-household__btn--ghost" onClick={() => { setMode(null); setError(''); }}>← Back</button>
              <button type="submit" className="join-household__btn join-household__btn--primary" disabled={loading}>
                {loading ? 'Joining…' : 'Join'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default JoinHousehold;
