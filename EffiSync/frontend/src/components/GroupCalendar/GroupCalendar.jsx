import { useMemo } from 'react';
import { mockMembers } from '../../mockData';
import './GroupCalendar.scss';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

function GroupCalendar({ groupTasks = [], members = [] }) {
  // Build calendar blocks from group tasks only
  const taskBlocks = useMemo(() => {
    const today = new Date();
    const currentDayOfWeek = (today.getDay() + 6) % 7; // Monday = 0

    return groupTasks
      .filter(t => t.status !== 'COMPLETED')
      .map(task => {
        // Determine which day column to show the task
        let dayIdx = 0;
        let startHour = 9;
        let span = 1;

        if (task.dueDate) {
          const taskDate = new Date(task.dueDate);
          dayIdx = (taskDate.getDay() + 6) % 7;
          startHour = taskDate.getHours() + (taskDate.getMinutes() / 60);
          if (task.duration) {
            span = Math.max(task.duration / 60, 0.5); // Min 30 mins
          }
        } else if (task.aiSuggestedTime) {
          const timeStr = task.aiSuggestedTime;
          const [startStr, endStr] = timeStr.split(' - ').map(s => s.trim());
          startHour = parseInt(startStr.split(':')[0]) || 9;
          const endHour = parseInt(endStr.split(':')[0]) || startHour + 1;
          span = Math.max(endHour - startHour, 1);
        }

        // Get assignee name
        const assigneeName = task.assignedTo?.name?.split(' ')[0] || 'Unassigned';

        const colors = ['#904399', '#5D0E66', '#F9C7FF', '#7B1FA2', '#B44BC7'];
        const colorIdx = members.findIndex(m => m.id === task.assignedToId);

        return {
          title: task.title,
          description: task.description,
          assigneeName,
          day: dayIdx,
          start: startHour,
          span,
          color: colors[colorIdx >= 0 ? colorIdx % colors.length : 0],
        };
      });
  }, [groupTasks, members]);

  return (
    <div className="group-cal">
      <div className="group-cal__header">
        <div className="group-cal__corner"></div>
        {WEEKDAYS.map(day => (
          <div key={day} className="group-cal__day-header">{day}</div>
        ))}
      </div>
      <div className="group-cal__body-scroll">
        <div className="group-cal__body">
          <div className="group-cal__times">
            {HOURS.map(h => (
              <div key={h} className="group-cal__time">{h}</div>
            ))}
          </div>
          <div className="group-cal__grid">
            {[0,1,2,3,4,5,6].map(dayIdx => (
              <div key={dayIdx} className="group-cal__column">
                {HOURS.map((_, hourIdx) => (
                  <div key={hourIdx} className="group-cal__cell"></div>
                ))}
                {taskBlocks.filter(b => b.day === dayIdx).map((block, i) => (
                  <div key={i} className="group-cal__block"
                    style={{
                      top: `${(block.start / HOURS.length) * 100}%`,
                      height: `${(block.span / HOURS.length) * 100}%`,
                      background: `${block.color}33`,
                      borderLeft: `3px solid ${block.color}`,
                    }}>
                    <div className="group-cal__block-content">
                      <span className="group-cal__block-title">{block.title}</span>
                      <span className="group-cal__block-name">{block.assigneeName}</span>
                    </div>
                    <div className="group-cal__block-tooltip">
                      <strong>{block.title}</strong>
                      {block.description && <p>{block.description}</p>}
                      <span className="tooltip-assignee">Assigned to: {block.assigneeName}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GroupCalendar;
