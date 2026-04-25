import { useState } from 'react';
import './AddGroupTaskModal.scss';

function AddGroupTaskModal({ isOpen, onClose, onAdd }) {
  const [form, setForm] = useState({
    title: '', description: '', difficulty: 3, category: 'OTHER', date: '', time: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    
    let dueDateStr = undefined;
    if (form.date) {
      dueDateStr = new Date(`${form.date}T${form.time || '00:00'}:00`).toISOString();
    }

    onAdd({
      title: form.title,
      description: form.description,
      difficulty: form.difficulty,
      category: form.category,
      type: 'GROUP',
      dueDate: dueDateStr,
    });
    setForm({ title: '', description: '', difficulty: 3, category: 'OTHER', date: '', time: '' });
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
            value={form.title} onChange={e => setForm({...form, title: e.target.value})} autoFocus required />
          <textarea className="add-gtask__input add-gtask__textarea" placeholder="Description" rows={2}
            value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <div className="add-gtask__row">
            <div className="add-gtask__field">
              <label className="add-gtask__label">Difficulty (1-5)</label>
              <input className="add-gtask__input" type="number" min="1" max="5"
                value={form.difficulty} onChange={e => setForm({...form, difficulty: parseInt(e.target.value) || 1})} />
            </div>
            <div className="add-gtask__field">
              <label className="add-gtask__label">Category</label>
              <select className="add-gtask__select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                <option value="CLEANING">Cleaning</option>
                <option value="SHOPPING">Shopping</option>
                <option value="ADMINISTRATIVE">Administrative</option>
                <option value="PERSONAL_GROWTH">Personal Growth</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div className="add-gtask__row">
            <div className="add-gtask__field">
              <label className="add-gtask__label">Due Date (Optional)</label>
              <input className="add-gtask__input" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            </div>
            <div className="add-gtask__field">
              <label className="add-gtask__label">Time</label>
              <input className="add-gtask__input" type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} disabled={!form.date} />
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
