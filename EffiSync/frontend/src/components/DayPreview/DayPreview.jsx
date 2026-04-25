import './DayPreview.scss';

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

function DayPreview({ date, tasks, onAddTask, onClose }) {
  if (!date) return null;

  const dayNum = new Date(date).getDate();
  const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

  const getTasksAtHour = (hour) => {
    return tasks.filter(t => t.startTime <= hour && t.endTime > hour);
  };

  return (
    <div className="day-preview" onClick={(e) => e.stopPropagation()}>
      <div className="day-preview__header">
        <h3 className="day-preview__title">{dayName}, {dayNum}</h3>
        <button className="day-preview__close" onClick={onClose}>×</button>
      </div>
      <div className="day-preview__hours">
        {HOURS.map((hour) => {
          const hourTasks = getTasksAtHour(hour);
          return (
            <div key={hour} className="day-preview__hour">
              <span className="day-preview__time">{hour}</span>
              <div className={`day-preview__slot ${hourTasks.length > 0 ? 'day-preview__slot--filled' : ''}`}>
                {hourTasks.length > 0 ? (
                  <div className="day-preview__tasks-stack">
                    {hourTasks.map(task => (
                      <div key={task.id} className="day-preview__task" style={{ borderLeftColor: task.color }}>
                        {task.title}
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    className="day-preview__add-btn"
                    onClick={() => onAddTask(date, hour)}
                  >
                    + Add task
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DayPreview;
