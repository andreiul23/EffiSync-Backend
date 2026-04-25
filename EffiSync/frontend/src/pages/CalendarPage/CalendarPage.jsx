import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import CalendarGrid from '../../components/CalendarGrid/CalendarGrid';
import DayPreview from '../../components/DayPreview/DayPreview';
import TaskModal from '../../components/TaskModal/TaskModal';
import PermanentScheduleModal from '../../components/PermanentScheduleModal/PermanentScheduleModal';
import GroupsSliderMenu from '../../components/GroupsSliderMenu/GroupsSliderMenu';
import CreateGroupModal from '../../components/CreateGroupModal/CreateGroupModal';
import JoinGroupModal from '../../components/JoinGroupModal/JoinGroupModal';
import CustomDropdown from '../../components/CustomDropdown/CustomDropdown';
import { mockTasks as initialTasks, mockGroups as initialGroups } from '../../mockData';
import './CalendarPage.scss';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function CalendarPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [tasks, setTasks] = useState([]);
  const [groups, setGroups] = useState(initialGroups);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await api.get('/tasks');
        setTasks(Array.isArray(data) ? data : (data.tasks || []));
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
      }
    };
    fetchTasks();
  }, []);

  // Date picker state
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth());
  const [pickerDay, setPickerDay] = useState(today.getDate());

  // UI state
  const [highlightDate, setHighlightDate] = useState(null);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayPreview, setShowDayPreview] = useState(false);
  const [isClosingPreview, setIsClosingPreview] = useState(false);

  // Modal state
  const [taskModal, setTaskModal] = useState({ open: false, task: null, date: null, time: null });
  const [permModal, setPermModal] = useState(false);
  const [groupsMenu, setGroupsMenu] = useState(false);
  const [createGroupModal, setCreateGroupModal] = useState(false);
  const [joinGroupModal, setJoinGroupModal] = useState(false);

  // Ref for outside click
  const previewRef = useRef(null);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  // Date picker search
  const handleDateSearch = () => {
    const daysInSelectedMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
    const day = Math.min(pickerDay, daysInSelectedMonth);
    const dateStr = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setHighlightDate(dateStr);
    setCurrentMonth(pickerMonth);
    setCurrentYear(pickerYear);
  };

  // Generate year options
  const yearOptions = Array.from({ length: 11 }, (_, i) => today.getFullYear() - 5 + i);
  const dayOptions = Array.from({ length: new Date(pickerYear, pickerMonth + 1, 0).getDate() }, (_, i) => i + 1);

  const handleDayClick = (dayData) => {
    setSelectedDay(dayData);
    setShowDayPreview(true);
    setIsClosingPreview(false);
  };

  const handleClosePreview = () => {
    setIsClosingPreview(true);
    setTimeout(() => {
      setShowDayPreview(false);
      setIsClosingPreview(false);
      setSelectedDay(null);
    }, 300);
  };

  const handleAddTask = (date, time) => {
    setTaskModal({ open: true, task: null, date, time });
  };

  const handleEditTask = (task) => {
    setTaskModal({ open: true, task, date: task.date, time: null });
  };

  const handleSaveTask = async (taskData) => {
    try {
      const isNew = String(taskData.id).startsWith('task-');
      if (isNew) {
        const { id, ...payload } = taskData;
        const savedTask = await api.post('/tasks', payload);
        setTasks(prev => [...prev, savedTask]);
      } else {
        const savedTask = await api.put(`/tasks/${taskData.id}`, taskData);
        setTasks(prev => prev.map(t => t.id === taskData.id ? savedTask : t));
      }
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  };

  const handleDeleteTask = (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleToggleDone = (taskId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: !t.done } : t));
  };

  const handleSavePerm = (schedule) => {
    const newTasks = [];
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentYear, currentMonth, d);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      if (schedule.days.includes(dayName)) {
        const dateStr = date.toISOString().split('T')[0];
        newTasks.push({
          id: `${schedule.id}-${dateStr}`,
          title: schedule.title,
          description: 'Permanent schedule',
          date: dateStr,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          color: schedule.color,
          done: false,
          isPermanent: true,
        });
      }
    }
    setTasks(prev => [...prev, ...newTasks]);
  };

  const handleCreateGroup = async (group) => {
    try {
      const res = await fetch('http://localhost:3000/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: group.name, createdById: user.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGroups(prev => [...prev, data.household]);
        setCreateGroupModal(false);
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const handleJoinGroup = () => {
    setJoinGroupModal(false);
  };

  const selectedDayTasks = useMemo(() => {
    if (!selectedDay?.date) return [];
    return tasks.filter(t => t.date === selectedDay.date);
  }, [selectedDay, tasks]);

  const initials = user ? `${(user.firstName || 'A').charAt(0)}${(user.lastName || 'P').charAt(0)}` : 'AP';

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (groupsMenu) {
        // GroupsSliderMenu handles its own backdrop click
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [groupsMenu]);

  return (
    <div className="calendar-page">
      {/* Top bar */}
      <div className="calendar-page__topbar">
        <div className="calendar-page__topbar-left">
          <button className="calendar-page__avatar" onClick={() => navigate('/account')}>
            {initials}
          </button>
        </div>

        <div className="calendar-page__topbar-center">
          <div className="calendar-page__date-picker">
            <CustomDropdown
              value={pickerYear}
              onChange={setPickerYear}
              options={yearOptions.map(y => ({ value: y, label: y.toString() }))}
            />
            <CustomDropdown
              value={pickerMonth}
              onChange={setPickerMonth}
              options={MONTH_NAMES.map((m, i) => ({ value: i, label: m }))}
            />
            <CustomDropdown
              value={pickerDay}
              onChange={setPickerDay}
              options={dayOptions.map(d => ({ value: d, label: d.toString() }))}
            />
            <button className="calendar-page__picker-btn" onClick={handleDateSearch}>
              Go
            </button>
          </div>
        </div>

        <div className="calendar-page__topbar-right">
          <button className="calendar-page__groups-btn" onClick={() => setGroupsMenu(true)}>
            Groups
          </button>
        </div>
      </div>

      {/* Month controls */}
      <div className="calendar-page__controls">
        <button className="calendar-page__nav-btn" onClick={prevMonth}>‹</button>
        <h2 className="calendar-page__month">{MONTH_NAMES[currentMonth]} {currentYear}</h2>
        <button className="calendar-page__nav-btn" onClick={nextMonth}>›</button>
        <button className="calendar-page__perm-btn" onClick={() => setPermModal(true)}>
          + Permanent Schedule
        </button>
      </div>

      {/* Calendar grid + day preview */}
      <div className="calendar-page__content">
        <div className={`calendar-page__grid-wrapper ${showDayPreview ? '' : 'calendar-page__grid-wrapper--full'}`}>
          <CalendarGrid
            year={currentYear}
            month={currentMonth}
            tasks={tasks}
            onDayClick={handleDayClick}
            onAddTask={handleAddTask}
            highlightDate={highlightDate}
            onDayHover={setHoveredDay}
            hoveredDay={hoveredDay}
          />
        </div>

        {showDayPreview && selectedDay && (
          <div
            ref={previewRef}
            className={`calendar-page__preview ${isClosingPreview ? 'calendar-page__preview--closing' : ''}`}
          >
            <DayPreview
              date={selectedDay.date}
              tasks={selectedDayTasks}
              onAddTask={handleAddTask}
              onClose={handleClosePreview}
            />
            {selectedDayTasks.length > 0 && (
              <div className="calendar-page__task-list">
                <h4>Tasks</h4>
                {selectedDayTasks.map(task => (
                  <button key={task.id} className="calendar-page__task-item"
                    onClick={() => handleEditTask(task)} style={{ borderLeftColor: task.color }}>
                    <span className={task.done ? 'calendar-page__task-done' : ''}>{task.title}</span>
                    <span className="calendar-page__task-time">{task.startTime} - {task.endTime}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <TaskModal
        isOpen={taskModal.open}
        onClose={() => setTaskModal({ open: false, task: null, date: null, time: null })}
        task={taskModal.task}
        date={taskModal.date}
        time={taskModal.time}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onToggleDone={handleToggleDone}
      />

      <PermanentScheduleModal
        isOpen={permModal}
        onClose={() => setPermModal(false)}
        onSave={handleSavePerm}
      />

      <GroupsSliderMenu
        isOpen={groupsMenu}
        onClose={() => setGroupsMenu(false)}
        groups={groups}
        onCreateGroup={() => { setGroupsMenu(false); setCreateGroupModal(true); }}
        onJoinGroup={() => { setGroupsMenu(false); setJoinGroupModal(true); }}
      />

      <CreateGroupModal
        isOpen={createGroupModal}
        onClose={() => setCreateGroupModal(false)}
        onCreate={handleCreateGroup}
      />

      <JoinGroupModal
        isOpen={joinGroupModal}
        onClose={() => setJoinGroupModal(false)}
        onJoin={handleJoinGroup}
      />
    </div>
  );
}

export default CalendarPage;
