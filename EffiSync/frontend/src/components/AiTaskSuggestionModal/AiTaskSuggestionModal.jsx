import { useState, useEffect } from 'react';
import CustomDropdown from '../CustomDropdown/CustomDropdown';
import './AiTaskSuggestionModal.scss';

const TIME_OPTIONS = [
  '08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
  '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00',
  '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00',
  '20:00 - 21:00'
].map(t => ({ value: t, label: t }));

function AiTaskSuggestionModal({ isOpen, onClose, task, userPoints, onAccept, onRefuse }) {
  const [editedTime, setEditedTime] = useState('');
  const [loadingTime, setLoadingTime] = useState(false);

  useEffect(() => {
    if (task) {
      if (task.dueDate) {
        const d = new Date(task.dueDate);
        const startStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        const endD = new Date(d.getTime() + (task.duration || 60) * 60000);
        const endStr = `${String(endD.getHours()).padStart(2,'0')}:${String(endD.getMinutes()).padStart(2,'0')}`;
        setEditedTime(`${startStr} - ${endStr}`);
      } else {
        // Fetch suggested time based on group calendar!
        setLoadingTime(true);
        fetch(`http://localhost:3000/api/households/${task.householdId}/suggest-time`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.suggestedTime) {
              setEditedTime(data.suggestedTime);
            } else {
              setEditedTime('09:00 - 10:00');
            }
          })
          .catch(() => setEditedTime('09:00 - 10:00'))
          .finally(() => setLoadingTime(false));
      }
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const totalPointsAfter = (userPoints || 0) + task.points;

  const handleAccept = () => {
    const updatedTask = { ...task, aiSuggestedTime: editedTime };
    onAccept(updatedTask);
    onClose();
  };

  // Ensure current time is in options
  const options = TIME_OPTIONS.some(o => o.value === editedTime) 
    ? TIME_OPTIONS 
    : [...TIME_OPTIONS, { value: editedTime, label: editedTime }];

  return (
    <div className="ai-suggest__overlay" onClick={onClose}>
      <div className="ai-suggest" onClick={e => e.stopPropagation()}>
        <div className="ai-suggest__header">
          <span className="ai-suggest__badge">🤖 AI Suggestion</span>
          <button className="ai-suggest__close" onClick={onClose}>×</button>
        </div>

        <div className="ai-suggest__body">
          <h3 className="ai-suggest__task-name">{task.title}</h3>
          <p className="ai-suggest__desc">{task.description}</p>

          <div className="ai-suggest__info">
            <div className="ai-suggest__info-item">
              <span className="ai-suggest__info-label">Points reward</span>
              <span className="ai-suggest__info-value">+{task.points} pts</span>
            </div>
            <div className="ai-suggest__info-item">
              <span className="ai-suggest__info-label">Your total after</span>
              <span className="ai-suggest__info-value ai-suggest__info-value--highlight">{totalPointsAfter} pts</span>
            </div>
            <div className="ai-suggest__info-item">
              <span className="ai-suggest__info-label">Suggested time</span>
              <CustomDropdown
                value={editedTime}
                onChange={setEditedTime}
                options={options}
                placeholder={loadingTime ? "Calculating..." : "Select time"}
              />
            </div>
          </div>
        </div>

        <div className="ai-suggest__actions">
          <button className="ai-suggest__btn ai-suggest__btn--refuse" onClick={() => { onRefuse(task); onClose(); }}>
            Refuse
          </button>
          <button className="ai-suggest__btn ai-suggest__btn--accept" onClick={handleAccept}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export default AiTaskSuggestionModal;
