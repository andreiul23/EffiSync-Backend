import './CalendarDay.scss';

function CalendarDay({ day, date, tasks, isToday, isHighlighted, isHovered, onClick, onMouseEnter, onMouseLeave }) {
  if (!day) {
    return <div className="cal-day cal-day--empty"></div>;
  }

  const classNames = [
    'cal-day',
    isToday && 'cal-day--today',
    isHighlighted && 'cal-day--highlighted',
    isHovered && 'cal-day--hovered',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="cal-day__num">{day}</span>
      {tasks.length > 0 && (
        <div className="cal-day__tasks">
          {tasks.slice(0, 3).map((task) => (
            <div
              key={task.id}
              className={`cal-day__task ${task.done ? 'cal-day__task--done' : ''}`}
              style={{ borderLeftColor: task.color }}
            >
              <span className="cal-day__task-title">{task.title}</span>
              <span className="cal-day__task-time">{task.startTime}</span>
            </div>
          ))}
          {tasks.length > 3 && (
            <span className="cal-day__more">+{tasks.length - 3} more</span>
          )}
        </div>
      )}
    </div>
  );
}

export default CalendarDay;
