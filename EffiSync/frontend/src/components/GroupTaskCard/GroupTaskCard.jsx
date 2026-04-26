import './GroupTaskCard.scss';

const statusLabels = { PENDING: 'Open', IN_PROGRESS: 'In Progress', COMPLETED: 'Done', AWAITING_REVIEW: 'Review' };

function difficultyTier(difficulty) {
  const d = Number(difficulty) || 1;
  if (d <= 2) return 'easy';
  if (d === 3) return 'medium';
  return 'hard';
}

function GroupTaskCard({ task, onClick, isAiSuggestedForUser }) {
  const isCompleted = task.status === 'COMPLETED';
  const tier = difficultyTier(task.difficulty);

  return (
    <div
      className={[
        'gtask-card',
        `gtask-card--diff-${tier}`,
        isAiSuggestedForUser ? 'gtask-card--ai' : '',
        isCompleted ? 'gtask-card--done' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      <div className="gtask-card__priority"></div>
      <div className="gtask-card__content">
        <div className="gtask-card__header">
          <span className="gtask-card__name">{task.title}</span>
          {isAiSuggestedForUser && <span className="gtask-card__ai-badge">AI suggested</span>}
        </div>
        <div className="gtask-card__meta">
          <span className="gtask-card__points">{task.pointsValue ?? 0} pts</span>
          <span className={`gtask-card__diff gtask-card__diff--${tier}`}>
            {tier === 'easy' ? 'Easy' : tier === 'medium' ? 'Medium' : 'Hard'}
          </span>
          <span className={`gtask-card__status gtask-card__status--${task.status}`}>
            {statusLabels[task.status] || task.status}
          </span>
        </div>
        {isCompleted && task.assignedTo?.name && (
          <div className="gtask-card__resolved">
            ✓ Resolved by {task.assignedTo.name}
          </div>
        )}
      </div>
    </div>
  );
}

export default GroupTaskCard;

