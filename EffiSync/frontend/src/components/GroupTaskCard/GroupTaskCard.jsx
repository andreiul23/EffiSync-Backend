import './GroupTaskCard.scss';

const statusLabels = { PENDING: 'Open', IN_PROGRESS: 'In Progress', COMPLETED: 'Done', AWAITING_REVIEW: 'In Review' };
const difficultyLabels = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

function difficultyTier(difficulty) {
  const d = Number(difficulty) || 1;
  if (d <= 2) return 'easy';
  if (d === 3) return 'medium';
  return 'hard';
}

function formatDue(dueDate) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfTarget - startOfToday) / 86400000);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return `Today · ${time}`;
  if (diffDays === 1) return `Tomorrow · ${time}`;
  if (diffDays === -1) return `Yesterday · ${time}`;
  if (diffDays > 1 && diffDays < 7) {
    const weekday = d.toLocaleDateString([], { weekday: 'short' });
    return `${weekday} · ${time}`;
  }
  const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  return `${dateStr} · ${time}`;
}

function GroupTaskCard({ task, onClick, isAiSuggestedForUser }) {
  const isCompleted = task.status === 'COMPLETED';
  const isOverdue = !isCompleted && task.dueDate && new Date(task.dueDate).getTime() < Date.now();
  const tier = difficultyTier(task.difficulty);
  const dueLabel = formatDue(task.dueDate);

  return (
    <div
      className={[
        'gtask-card',
        `gtask-card--diff-${tier}`,
        `gtask-card--status-${task.status}`,
        isAiSuggestedForUser ? 'gtask-card--ai' : '',
        isCompleted ? 'gtask-card--done' : '',
        isOverdue ? 'gtask-card--overdue' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
    >
      <div className="gtask-card__priority" aria-hidden />
      <div className="gtask-card__content">
        <div className="gtask-card__row">
          <span className="gtask-card__name">{task.title}</span>
          <div className="gtask-card__badges">
            {isAiSuggestedForUser && <span className="gtask-card__ai-badge">AI</span>}
            <span className={`gtask-card__status gtask-card__status-pill--${task.status}`}>
              <span className="gtask-card__status-dot" /> {statusLabels[task.status] || task.status}
            </span>
          </div>
        </div>

        <div className="gtask-card__meta">
          <span className="gtask-card__points">{task.pointsValue ?? 0} pts</span>
          <span className="gtask-card__sep">·</span>
          <span className={`gtask-card__diff gtask-card__diff--${tier}`}>{difficultyLabels[tier]}</span>
          {dueLabel && (
            <>
              <span className="gtask-card__sep">·</span>
              <span className={`gtask-card__due ${isOverdue ? 'gtask-card__due--overdue' : ''}`}>
                {isOverdue ? 'Overdue · ' : ''}{dueLabel}
              </span>
            </>
          )}
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


