import { useState } from 'react';
import './PermanentScheduleModal.scss';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function PermanentScheduleModal({ isOpen, onClose, onSave }) {
  const [form, setForm] = useState({
    title: '',
    startTime: '09:00',
    endTime: '17:00',
    days: [],
    color: '#904399',
  });

  if (!isOpen) return null;

  const toggleDay = (day) => {
    setForm(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || form.days.length === 0) return;
    onSave({ ...form, id: `perm-${Date.now()}` });
    onClose();
  };

  return (
    <div className="perm-modal__overlay" onClick={onClose}>
      <div className="perm-modal" onClick={e => e.stopPropagation()}>
        <div className="perm-modal__header">
          <h3>Add Permanent Schedule</h3>
          <button className="perm-modal__close" onClick={onClose}>×</button>
        </div>
        <form className="perm-modal__form" onSubmit={handleSubmit}>
          <div className="perm-modal__field">
            <label className="perm-modal__label">Title</label>
            <input className="perm-modal__input" type="text" placeholder="e.g. Work, Gym, Classes"
              value={form.title} onChange={e => setForm({...form, title: e.target.value})} autoFocus />
          </div>
          <div className="perm-modal__row">
            <div className="perm-modal__field">
              <label className="perm-modal__label">Start</label>
              <input className="perm-modal__input" type="time" value={form.startTime}
                onChange={e => setForm({...form, startTime: e.target.value})} />
            </div>
            <div className="perm-modal__field">
              <label className="perm-modal__label">End</label>
              <input className="perm-modal__input" type="time" value={form.endTime}
                onChange={e => setForm({...form, endTime: e.target.value})} />
            </div>
          </div>
          <div className="perm-modal__field">
            <label className="perm-modal__label">Recurring Days</label>
            <div className="perm-modal__days">
              {DAYS.map(day => (
                <button key={day} type="button"
                  className={`perm-modal__day ${form.days.includes(day) ? 'perm-modal__day--active' : ''}`}
                  onClick={() => toggleDay(day)}>
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
          <div className="perm-modal__actions">
            <button type="button" className="perm-modal__btn perm-modal__btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="perm-modal__btn perm-modal__btn--primary">Save Schedule</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PermanentScheduleModal;
