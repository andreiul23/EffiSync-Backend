import { useState, useMemo } from 'react';
import CalendarDay from '../CalendarDay/CalendarDay';
import './CalendarGrid.scss';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function CalendarGrid({ year, month, tasks, onDayClick, onAddTask, highlightDate, onDayHover, hoveredDay }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const calendarDays = useMemo(() => {
    const days = [];
    // Previous month padding
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ day: null, key: `pad-${i}` });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTasks = tasks.filter(t => t.date === dateStr);
      days.push({
        day: d,
        date: dateStr,
        tasks: dayTasks,
        isToday: dateStr === todayStr,
        isHighlighted: dateStr === highlightDate,
        key: dateStr,
      });
    }
    return days;
  }, [year, month, tasks, highlightDate, todayStr, daysInMonth, firstDayOfWeek]);

  return (
    <div className="cal-grid">
      <div className="cal-grid__header">
        {WEEKDAYS.map(day => (
          <div key={day} className="cal-grid__weekday">{day}</div>
        ))}
      </div>
      <div className="cal-grid__body">
        {calendarDays.map((d) => (
          <CalendarDay
            key={d.key}
            day={d.day}
            date={d.date}
            tasks={d.tasks || []}
            isToday={d.isToday}
            isHighlighted={d.isHighlighted}
            isHovered={hoveredDay === d.date}
            onClick={() => d.day && onDayClick(d)}
            onMouseEnter={() => d.day && onDayHover(d.date)}
            onMouseLeave={() => onDayHover(null)}
            onAddTask={onAddTask}
          />
        ))}
      </div>
    </div>
  );
}

export default CalendarGrid;
