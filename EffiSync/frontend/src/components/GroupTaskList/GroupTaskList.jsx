import GroupTaskCard from '../GroupTaskCard/GroupTaskCard';
import './GroupTaskList.scss';

function GroupTaskList({ tasks, onTaskClick, currentUserId }) {
  return (
    <div className="group-task-list">
      <h3 className="group-task-list__title">Tasks</h3>
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
    </div>
  );
}

export default GroupTaskList;
