import './DayPreview.scss';

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

// Parse "HH:MM" → minutes since midnight. Returns null for invalid/missing input
// so we can robustly skip tasks that don't have proper time fields instead of
// silently misplacing them with string compare.
const toMinutes = (t) => {
  if (typeof t !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
};

function DayPreview({ date, tasks, onAddTask, onClose }) {
  if (!date) return null;

  const dayNum = new Date(date).getDate();
  const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

  const getTasksAtHour = (hour) => {
    const hourMin = toMinutes(hour);
    if (hourMin === null) return [];
    return tasks.filter((t) => {
      const start = toMinutes(t.startTime);
      const end = toMinutes(t.endTime);
      if (start === null || end === null) return false;
      return start <= hourMin && end > hourMin;
    });
  };

  const hasAnyTasks = tasks.some((t) => toMinutes(t.startTime) !== null);

  return (
    <div
      className="day-preview"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-preview-title"
    >
      <div className="day-preview__header">
        <h3 className="day-preview__title" id="day-preview-title">{dayName}, {dayNum}</h3>
        <button className="day-preview__close" onClick={onClose} aria-label="Close day view">×</button>
      </div>
      {!hasAnyTasks && (
        <div className="day-preview__empty">
          <p className="day-preview__empty-title">No tasks scheduled</p>
          <p className="day-preview__empty-sub">Pick an hour below to add your first task.</p>
        </div>
      )}
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
                      <div
                        key={task.id}
                        className="day-preview__task"
                        style={{ borderLeftColor: task.color }}
                        title={task.title}
                      >
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
