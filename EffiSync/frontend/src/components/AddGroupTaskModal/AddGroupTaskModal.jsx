import { useState } from 'react';
import './AddGroupTaskModal.scss';

function AddGroupTaskModal({ isOpen, onClose, onAdd }) {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', points: 5,
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onAdd({
      ...form,
      id: `gt-${Date.now()}`,
      status: 'open',
      assignedTo: null,
      aiSuggested: false,
      aiSuggestedTo: null,
      aiSuggestedTime: null,
      refusalCount: 0,
      date: new Date().toISOString().split('T')[0],
    });
    setForm({ title: '', description: '', priority: 'medium', points: 5 });
    onClose();
  };

  return (
    <div className="add-gtask__overlay" onClick={onClose}>
      <div className="add-gtask" onClick={e => e.stopPropagation()}>
        <div className="add-gtask__header">
          <h3>Add Group Task</h3>
          <button className="add-gtask__close" onClick={onClose}>×</button>
        </div>
        <form className="add-gtask__form" onSubmit={handleSubmit}>
          <input className="add-gtask__input" type="text" placeholder="Task name"
            value={form.title} onChange={e => setForm({...form, title: e.target.value})} autoFocus />
          <textarea className="add-gtask__input add-gtask__textarea" placeholder="Description" rows={3}
            value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <div className="add-gtask__row">
            <div className="add-gtask__field">
              <label className="add-gtask__label">Priority</label>
              <select className="add-gtask__select" value={form.priority}
                onChange={e => setForm({...form, priority: e.target.value})}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="add-gtask__field">
              <label className="add-gtask__label">Points</label>
              <input className="add-gtask__input" type="number" min="1" max="100"
                value={form.points} onChange={e => setForm({...form, points: parseInt(e.target.value) || 0})} />
            </div>
          </div>
          <div className="add-gtask__actions">
            <button type="button" className="add-gtask__btn add-gtask__btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="add-gtask__btn add-gtask__btn--primary">Add Task</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddGroupTaskModal;
