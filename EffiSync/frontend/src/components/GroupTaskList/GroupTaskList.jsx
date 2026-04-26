import { useMemo, useState } from 'react';
import GroupTaskCard from '../GroupTaskCard/GroupTaskCard';
import './GroupTaskList.scss';

const FILTERS = [
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
];

function GroupTaskList({ tasks, onTaskClick, currentUserId, onCreateClick }) {
  const [filter, setFilter] = useState('active');

  const counts = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'COMPLETED').length;
    const done = tasks.filter(t => t.status === 'COMPLETED').length;
    return { active, done, all: tasks.length };
  }, [tasks]);

  const visible = useMemo(() => {
    let list = tasks;
    if (filter === 'active') list = tasks.filter(t => t.status !== 'COMPLETED');
    else if (filter === 'done') list = tasks.filter(t => t.status === 'COMPLETED');

    const statusOrder = { AWAITING_REVIEW: 0, IN_PROGRESS: 1, PENDING: 2, COMPLETED: 3 };
    return [...list].sort((a, b) => {
      const sa = statusOrder[a.status] ?? 4;
      const sb = statusOrder[b.status] ?? 4;
      if (sa !== sb) return sa - sb;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      if (a.status === 'COMPLETED') return db - da;
      return da - db;
    });
  }, [tasks, filter]);

  return (
    <div className="group-task-list">
      <div className="group-task-list__header">
        <div className="group-task-list__title-wrap">
          <h3 className="group-task-list__title">Tasks</h3>
          <span className="group-task-list__count">{counts.all}</span>
        </div>
        {tasks.length > 0 && (
          <div className="group-task-list__tabs" role="tablist">
            {FILTERS.map(f => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                className={`group-task-list__tab ${filter === f.id ? 'is-active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                <span>{f.label}</span>
                <span className="group-task-list__tab-count">{counts[f.id]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

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
      ) : visible.length === 0 ? (
        <div className="group-task-list__empty-filter">
          <p>No {filter === 'done' ? 'completed' : 'active'} tasks.</p>
        </div>
      ) : (
        <div className="group-task-list__items">
          {visible.map(task => (
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

