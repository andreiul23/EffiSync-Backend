import { useState } from 'react';
import { ai } from '../../services/api';
import './AddGroupTaskModal.scss';

const EMPTY_FORM = {
  title: '',
  description: '',
  difficulty: 3,
  points: 30,
  assignedToId: '',
  category: 'OTHER',
  date: '',
  time: '',
};

function AddGroupTaskModal({ isOpen, onClose, onAdd, members = [] }) {
  const [mode, setMode] = useState('ai'); // 'ai' | 'manual'
  const [prompt, setPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  if (!isOpen) return null;

  const reset = () => {
    setForm(EMPTY_FORM);
    setPrompt('');
    setAiSuggestion(null);
    setAiError(null);
    setMode('ai');
  };

  const close = () => { reset(); onClose(); };

  const handleAskAI = async () => {
    if (!prompt.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await ai.suggestTask(prompt.trim());
      const s = res.suggestion;
      setAiSuggestion(s);
      let timeVal = '';
      if (typeof s.suggestedTime === 'string') {
        const m = s.suggestedTime.match(/(\d{1,2}:\d{2})/);
        if (m) timeVal = m[1].padStart(5, '0');
      }
      const today = new Date();
      const dateVal = today.toISOString().split('T')[0];
      setForm({
        title: s.title || '',
        description: s.description || '',
        difficulty: s.difficulty ?? 3,
        points: s.pointsValue ?? 30,
        assignedToId: s.assignedToId || '',
        category: s.category || 'OTHER',
        date: dateVal,
        time: timeVal,
      });
    } catch (err) {
      setAiError(err.message || 'AI suggestion failed');
    } finally {
      setAiLoading(false);
    }
  };

  const setPoints = (delta) => {
    setForm((f) => {
      const next = Math.max(5, Math.min(500, (Number(f.points) || 0) + delta));
      return { ...f, points: next };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    let dueDateStr;
    if (form.date) {
      dueDateStr = new Date(`${form.date}T${form.time || '00:00'}:00`).toISOString();
    }
    const safePoints = Number.isFinite(Number(form.points)) ? Number(form.points) : 10;

    onAdd({
      title: form.title,
      description: form.description,
      difficulty: form.difficulty,
      pointsValue: safePoints,
      assignedToId: form.assignedToId || undefined,
      category: form.category,
      type: 'GROUP',
      dueDate: dueDateStr,
    });
    reset();
    onClose();
  };

  const assigneeName = (id) => {
    const m = members.find((x) => x.id === id);
    return m ? (m.name || m.email) : 'Unassigned';
  };

  return (
    <div className="add-gtask__overlay" onClick={close}>
      <div className="add-gtask" onClick={(e) => e.stopPropagation()}>
        <div className="add-gtask__header">
          <h3>{mode === 'ai' ? '✨ AI Task Planner' : 'Add Group Task'}</h3>
          <button className="add-gtask__close" onClick={close}>×</button>
        </div>

        <div className="add-gtask__tabs">
          <button
            type="button"
            className={`add-gtask__tab ${mode === 'ai' ? 'add-gtask__tab--active' : ''}`}
            onClick={() => setMode('ai')}
          >✨ AI</button>
          <button
            type="button"
            className={`add-gtask__tab ${mode === 'manual' ? 'add-gtask__tab--active' : ''}`}
            onClick={() => { setMode('manual'); setAiSuggestion(null); }}
          >Manual</button>
        </div>

        {mode === 'ai' && !aiSuggestion && (
          <div className="add-gtask__ai-intake">
            <p className="add-gtask__ai-hint">
              Describe what needs to get done. The AI will pick the best person,
              time, points, and difficulty based on the household's current load.
            </p>
            <textarea
              className="add-gtask__input add-gtask__textarea"
              placeholder='e.g. "We are out of milk and bread, also the trash is full"'
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              autoFocus
            />
            {aiError && <div className="add-gtask__error">{aiError}</div>}
            <div className="add-gtask__actions">
              <button type="button" className="add-gtask__btn add-gtask__btn--ghost" onClick={close}>Cancel</button>
              <button
                type="button"
                className="add-gtask__btn add-gtask__btn--primary"
                onClick={handleAskAI}
                disabled={aiLoading || !prompt.trim()}
              >
                {aiLoading ? 'Thinking…' : '✨ Generate'}
              </button>
            </div>
          </div>
        )}

        {(mode === 'manual' || aiSuggestion) && (
          <form className="add-gtask__form" onSubmit={handleSubmit}>
            {aiSuggestion?.reasoning && (
              <div className="add-gtask__ai-reason">
                <span className="add-gtask__ai-reason-badge">AI</span>
                {aiSuggestion.reasoning}
              </div>
            )}

            <input
              className="add-gtask__input"
              type="text"
              placeholder="Task name"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <textarea
              className="add-gtask__input add-gtask__textarea"
              placeholder="Description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />

            <div className="add-gtask__row">
              <div className="add-gtask__field">
                <label className="add-gtask__label">Difficulty (1-5)</label>
                <input
                  className="add-gtask__input"
                  type="number" min="1" max="5"
                  value={form.difficulty}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setForm({ ...form, difficulty: Number.isFinite(v) ? Math.max(1, Math.min(5, v)) : 1 });
                  }}
                />
              </div>
              <div className="add-gtask__field">
                <label className="add-gtask__label">Points reward</label>
                <div className="add-gtask__stepper">
                  <button type="button" className="add-gtask__stepper-btn" onClick={() => setPoints(-5)} aria-label="Decrease">−</button>
                  <input
                    className="add-gtask__stepper-input"
                    type="number" min="5" max="500" step="5"
                    value={form.points}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      setForm({ ...form, points: Number.isFinite(v) ? v : 10 });
                    }}
                  />
                  <button type="button" className="add-gtask__stepper-btn" onClick={() => setPoints(5)} aria-label="Increase">+</button>
                </div>
              </div>
            </div>

            <div className="add-gtask__row">
              <div className="add-gtask__field">
                <label className="add-gtask__label">
                  Assign to {aiSuggestion && <span className="add-gtask__chip">AI: {assigneeName(aiSuggestion.assignedToId)}</span>}
                </label>
                <select
                  className="add-gtask__select"
                  value={form.assignedToId}
                  onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                >
                  <option value="">— Unassigned (open) —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name || m.email}</option>
                  ))}
                </select>
              </div>
              <div className="add-gtask__field">
                <label className="add-gtask__label">Category</label>
                <select
                  className="add-gtask__select"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
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
                <input
                  className="add-gtask__input"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="add-gtask__field">
                <label className="add-gtask__label">
                  Time {aiSuggestion?.suggestedTime && <span className="add-gtask__chip">AI: {aiSuggestion.suggestedTime}</span>}
                </label>
                <input
                  className="add-gtask__input"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  disabled={!form.date}
                />
              </div>
            </div>

            <div className="add-gtask__actions">
              {aiSuggestion && (
                <button
                  type="button"
                  className="add-gtask__btn add-gtask__btn--ghost"
                  onClick={() => { setAiSuggestion(null); setForm(EMPTY_FORM); }}
                >↺ Re-ask AI</button>
              )}
              <button type="button" className="add-gtask__btn add-gtask__btn--ghost" onClick={close}>Cancel</button>
              <button type="submit" className="add-gtask__btn add-gtask__btn--primary">
                {aiSuggestion ? 'Accept & Add Task' : 'Add Task'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default AddGroupTaskModal;
