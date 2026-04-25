import './GroupTaskCard.scss';

const difficultyColors = { 1: '#4caf50', 2: '#8bc34a', 3: '#ff9800', 4: '#ff5722', 5: '#f44336' };
const statusLabels = { PENDING: 'Open', IN_PROGRESS: 'In Progress', COMPLETED: 'Done', AWAITING_REVIEW: 'Review' };

function GroupTaskCard({ task, onClick, isAiSuggestedForUser }) {
  const isCompleted = task.status === 'COMPLETED';
  return (
    <div className={`gtask-card ${isAiSuggestedForUser ? 'gtask-card--ai' : ''} ${isCompleted ? 'gtask-card--done' : ''}`} onClick={onClick} style={isCompleted ? { backgroundColor: '#e8f5e9', borderColor: '#4caf50' } : {}}>
      <div className="gtask-card__priority" style={{ background: difficultyColors[task.difficulty] || '#ff9800' }}></div>
      <div className="gtask-card__content">
        <div className="gtask-card__header">
          <span className="gtask-card__name">{task.title}</span>
          {isAiSuggestedForUser && <span className="gtask-card__ai-badge">AI suggested</span>}
        </div>
        <div className="gtask-card__meta">
          <span className="gtask-card__points">{task.pointsValue} pts</span>
          <span className={`gtask-card__status gtask-card__status--${task.status}`}>
            {statusLabels[task.status] || task.status}
          </span>
        </div>
        {isCompleted && task.assignedTo?.name && (
          <div style={{ fontSize: '0.75rem', color: '#4caf50', marginTop: '0.2rem' }}>
            ✓ Resolved by {task.assignedTo.name}
          </div>
        )}
      </div>
    </div>
  );
}

export default GroupTaskCard;
