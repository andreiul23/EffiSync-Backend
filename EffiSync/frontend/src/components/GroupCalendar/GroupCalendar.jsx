import { useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './GroupCalendar.scss';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

function GroupCalendar({ groupTasks = [], members = [] }) {
  const [hover, setHover] = useState(null); // { x, y, block }

  const handleMove = useCallback((e, block) => {
    setHover({ x: e.clientX, y: e.clientY, block });
  }, []);
  const handleLeave = useCallback(() => setHover(null), []);
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
        let startLabel = '';
        let endLabel = '';

        if (task.dueDate) {
          const taskDate = new Date(task.dueDate);
          dayIdx = (taskDate.getDay() + 6) % 7;
          startHour = taskDate.getHours() + (taskDate.getMinutes() / 60);
          if (task.duration) {
            span = Math.max(task.duration / 60, 0.5); // Min 30 mins
          }
          const fmt = (h) => {
            const hh = Math.floor(h);
            const mm = Math.round((h - hh) * 60);
            return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
          };
          startLabel = fmt(startHour);
          endLabel = fmt(startHour + span);
        } else if (task.aiSuggestedTime) {
          const timeStr = task.aiSuggestedTime;
          const [startStr, endStr] = timeStr.split(' - ').map(s => s.trim());
          startHour = parseInt(startStr.split(':')[0]) || 9;
          const endHour = parseInt(endStr.split(':')[0]) || startHour + 1;
          span = Math.max(endHour - startHour, 1);
          startLabel = startStr || `${String(startHour).padStart(2,'0')}:00`;
          endLabel = endStr || `${String(startHour + span).padStart(2,'0')}:00`;
        }

        // Get assignee name
        const assigneeName = task.assignedTo?.name?.split(' ')[0] || 'Unassigned';
        const assigneeFull = task.assignedTo?.name || 'Unassigned';
        const assigneeEmail = task.assignedTo?.email || '';

        const colors = ['#904399', '#5D0E66', '#F9C7FF', '#7B1FA2', '#B44BC7'];
        const colorIdx = members.findIndex(m => m.id === task.assignedToId);

        return {
          title: task.title,
          description: task.description,
          assigneeName,
          assigneeFull,
          assigneeEmail,
          status: task.status,
          category: task.category,
          pointsValue: task.pointsValue,
          difficulty: task.difficulty,
          dueDate: task.dueDate,
          startLabel,
          endLabel,
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
                    onMouseEnter={(e) => handleMove(e, block)}
                    onMouseMove={(e) => handleMove(e, block)}
                    onMouseLeave={handleLeave}
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
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {hover && typeof document !== 'undefined' && createPortal((() => {
        const M = 12;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Tooltip width matches the SCSS rule: min(320px, vw - 24px)
        const TT_W = Math.min(320, vw - 24);
        const TT_H_EST = 280;

        let left = hover.x + 14;
        if (left + TT_W + M > vw) {
          left = hover.x - TT_W - 14;
        }
        left = Math.max(M, Math.min(left, vw - TT_W - M));

        let top = hover.y - 10;
        const useBelow = hover.y < TT_H_EST + M;
        const translateY = useBelow ? '0' : '-100%';
        if (useBelow) top = hover.y + 18;
        if (useBelow) {
          top = Math.max(M, Math.min(top, vh - TT_H_EST - M));
        } else {
          top = Math.max(TT_H_EST + M, Math.min(top, vh - M));
        }

        return (
        <div
          className="group-cal__floating-tooltip"
          style={{
            left,
            top,
            transform: `translateY(${translateY})`,
            ['--tt-accent']: hover.block.color,
          }}
        >
          <div className="group-cal__floating-tooltip-header">
            <span
              className="group-cal__floating-tooltip-dot"
              style={{ background: hover.block.color }}
            />
            <strong>{hover.block.title}</strong>
          </div>

          {hover.block.description && (
            <p className="group-cal__floating-tooltip-desc">{hover.block.description}</p>
          )}

          <div className="group-cal__floating-tooltip-grid">
            {(hover.block.startLabel || hover.block.endLabel) && (
              <>
                <span className="group-cal__floating-tooltip-key">When</span>
                <span className="group-cal__floating-tooltip-val">
                  {WEEKDAYS[hover.block.day]} · {hover.block.startLabel}
                  {hover.block.endLabel ? ` – ${hover.block.endLabel}` : ''}
                </span>
              </>
            )}

            <span className="group-cal__floating-tooltip-key">Assigned</span>
            <span className="group-cal__floating-tooltip-val">
              {hover.block.assigneeFull}
              {hover.block.assigneeEmail && (
                <span className="group-cal__floating-tooltip-sub">{hover.block.assigneeEmail}</span>
              )}
            </span>

            {hover.block.category && (
              <>
                <span className="group-cal__floating-tooltip-key">Category</span>
                <span className="group-cal__floating-tooltip-val">{hover.block.category}</span>
              </>
            )}

            {typeof hover.block.pointsValue === 'number' && (
              <>
                <span className="group-cal__floating-tooltip-key">Reward</span>
                <span className="group-cal__floating-tooltip-val">
                  <span className="group-cal__floating-tooltip-pill group-cal__floating-tooltip-pill--points">
                    {hover.block.pointsValue} pts
                  </span>
                  {typeof hover.block.difficulty === 'number' && (
                    <span className="group-cal__floating-tooltip-pill">
                      Difficulty {hover.block.difficulty}/5
                    </span>
                  )}
                </span>
              </>
            )}

            {hover.block.status && (
              <>
                <span className="group-cal__floating-tooltip-key">Status</span>
                <span className="group-cal__floating-tooltip-val">
                  <span
                    className={`group-cal__floating-tooltip-pill group-cal__floating-tooltip-pill--status group-cal__floating-tooltip-pill--${String(hover.block.status).toLowerCase()}`}
                  >
                    {hover.block.status}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>
        );
      })(), document.body)}
    </div>
  );
}

export default GroupCalendar;
