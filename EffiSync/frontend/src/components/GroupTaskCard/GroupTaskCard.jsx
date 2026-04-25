import './GroupTaskCard.scss';

const priorityColors = { low: '#4caf50', medium: '#ff9800', high: '#f44336' };
const statusLabels = { open: 'Open', 'in-progress': 'In Progress', done: 'Done' };

function GroupTaskCard({ task, onClick, isAiSuggestedForUser }) {
  return (
    <div className={`gtask-card ${isAiSuggestedForUser ? 'gtask-card--ai' : ''}`} onClick={onClick}>
      <div className="gtask-card__priority" style={{ background: priorityColors[task.priority] }}></div>
      <div className="gtask-card__content">
        <div className="gtask-card__header">
          <span className="gtask-card__name">{task.title}</span>
          {isAiSuggestedForUser && <span className="gtask-card__ai-badge">AI suggested</span>}
        </div>
        <div className="gtask-card__meta">
          <span className="gtask-card__points">{task.points} pts</span>
          <span className={`gtask-card__status gtask-card__status--${task.status}`}>
            {statusLabels[task.status]}
          </span>
        </div>
      </div>
    </div>
  );
}

export default GroupTaskCard;
