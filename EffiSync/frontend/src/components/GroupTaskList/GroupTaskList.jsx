import GroupTaskCard from '../GroupTaskCard/GroupTaskCard';
import './GroupTaskList.scss';

function GroupTaskList({ tasks, onTaskClick, currentUserId, onCreateClick }) {
  return (
    <div className="group-task-list">
      <h3 className="group-task-list__title">Tasks</h3>
      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__emoji">📋</div>
          <h4 className="empty-state__title">No tasks yet</h4>
          <p className="empty-state__desc">
            Create your first household task to get started, or ask the AI to plan your week.
          </p>
          {onCreateClick && (
            <div className="empty-state__actions">
              <button className="empty-state__btn empty-state__btn--primary" onClick={onCreateClick}>
                + Add a task
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="group-task-list__items">
          {tasks.map(task => (
            <GroupTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              isAiSuggestedForUser={task.aiSuggested && task.aiSuggestedTo === currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default GroupTaskList;
