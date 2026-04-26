import { useState, useEffect } from 'react';
import './TaskModal.scss';

function TaskModal({ isOpen, onClose, task, date, time, onSave, onDelete, onToggleDone }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    color: '#904399',
  });
  const [titleError, setTitleError] = useState(false);

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        startTime: task.startTime || '',
        endTime: task.endTime || '',
        color: task.color || '#904399',
      });
    } else {
      setForm({
        title: '',
        description: '',
        startTime: time || '',
        endTime: time ? `${String(parseInt(time) + 1).padStart(2, '0')}:00` : '',
        color: '#904399',
      });
    }
    setTitleError(false);
  }, [task, time, isOpen]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isEditing = !!task;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      // Surface the error inline instead of silently aborting.
      setTitleError(true);
      return;
    }
    onSave({
      ...task,
      ...form,
      date: date,
      id: task?.id || `task-${Date.now()}`,
      done: task?.done || false,
      isPermanent: false,
    });
    onClose();
  };

  const colors = ['#904399', '#5D0E66', '#F9C7FF', '#515151', '#7B1FA2', '#E91E63'];

  return (
    <div className="task-modal__overlay" onClick={onClose} role="presentation">
      <div
        className="task-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        <div className="task-modal__header">
          <h3 className="task-modal__title" id="task-modal-title">{isEditing ? 'Edit Task' : 'New Task'}</h3>
          <button className="task-modal__close" onClick={onClose} aria-label="Close dialog">×</button>
        </div>

        <form className="task-modal__form" onSubmit={handleSubmit} noValidate>
          <div className="task-modal__field">
            <input
              className={`task-modal__input task-modal__input--title${titleError ? ' task-modal__input--error' : ''}`}
              type="text"
              placeholder="Task title"
              value={form.title}
              onChange={(e) => {
                if (titleError && e.target.value.trim()) setTitleError(false);
                setForm({ ...form, title: e.target.value });
              }}
              aria-invalid={titleError}
              aria-describedby={titleError ? 'task-modal-title-error' : undefined}
              autoFocus
            />
            {titleError && (
              <p className="task-modal__error" id="task-modal-title-error" role="alert">
                Please enter a title for this task.
              </p>
            )}
          </div>

          <div className="task-modal__field">
            <textarea
              className="task-modal__input task-modal__textarea"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="task-modal__row">
            <div className="task-modal__field">
              <label className="task-modal__label" htmlFor="task-modal-start">Start</label>
              <input
                id="task-modal-start"
                className="task-modal__input"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </div>
            <div className="task-modal__field">
              <label className="task-modal__label" htmlFor="task-modal-end">End</label>
              <input
                id="task-modal-end"
                className="task-modal__input"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </div>
          </div>

          <div className="task-modal__field">
            <label className="task-modal__label">Color</label>
            <div className="task-modal__colors" role="radiogroup" aria-label="Task color">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={form.color === c}
                  aria-label={`Color ${c}`}
                  className={`task-modal__color ${form.color === c ? 'task-modal__color--active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm({ ...form, color: c })}
                />
              ))}
            </div>
          </div>

          <div className="task-modal__actions">
            {isEditing && (
              <>
                <button
                  type="button"
                  className="task-modal__btn task-modal__btn--danger"
                  onClick={() => { onDelete(task.id); onClose(); }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="task-modal__btn task-modal__btn--ghost"
                  onClick={() => { onToggleDone(task.id); onClose(); }}
                >
                  {task.done ? 'Mark Undone' : 'Mark Done'}
                </button>
              </>
            )}
            <div className="task-modal__actions-right">
              <button type="button" className="task-modal__btn task-modal__btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="task-modal__btn task-modal__btn--primary">
                {isEditing ? 'Save' : 'Add Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TaskModal;
