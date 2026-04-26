import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, calendar as calendarApi, households } from '../../services/api';
import CalendarGrid from '../../components/CalendarGrid/CalendarGrid';
import DayPreview from '../../components/DayPreview/DayPreview';
import TaskModal from '../../components/TaskModal/TaskModal';
import PermanentScheduleModal from '../../components/PermanentScheduleModal/PermanentScheduleModal';
import GroupsSliderMenu from '../../components/GroupsSliderMenu/GroupsSliderMenu';
import CreateGroupModal from '../../components/CreateGroupModal/CreateGroupModal';
import JoinGroupModal from '../../components/JoinGroupModal/JoinGroupModal';
import CustomDropdown from '../../components/CustomDropdown/CustomDropdown';
import { useToast } from '../../components/Toast/ToastProvider';
import './CalendarPage.scss';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function CalendarPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const toast = useToast();
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [tasks, setTasks] = useState([]);
  const [groups, setGroups] = useState([]);

  const fetchTasks = async () => {
    if (!user?.id) return;
    try {
      const query = `?userId=${user.id}`;
      const data = await api.get(`/tasks${query}`);
      const rawTasks = Array.isArray(data) ? data : (data.tasks || []);
      const mappedTasks = rawTasks.map(t => {
        if (!t.dueDate) return t;
        const d = new Date(t.dueDate);
        const date = d.toISOString().split('T')[0];
        const startTime = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        let endTime = '23:59';
        if (t.duration) {
          const endD = new Date(d.getTime() + t.duration * 60000);
          endTime = `${String(endD.getHours()).padStart(2,'0')}:${String(endD.getMinutes()).padStart(2,'0')}`;
        }
        return { ...t, date, startTime, endTime, done: t.status === 'COMPLETED' };
      });
      setTasks(mappedTasks);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      toast.error('Failed to load tasks');
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user?.id, user?.householdId]);

  useEffect(() => {
    const fetchHousehold = async () => {
      if (user?.householdId) {
        try {
          const data = await households.getById(user.householdId);
          if (data.success && data.household) {
            setGroups([data.household]);
          }
        } catch (err) {
          console.error('Failed to fetch household:', err);
        }
      } else {
        setGroups([]);
      }
    };
    fetchHousehold();
  }, [user?.householdId]);

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

  const [isSyncing, setIsSyncing] = useState(false);
  const handleSyncCalendar = async () => {
    setIsSyncing(true);
    const loadingId = toast.info('Syncing with Google Calendar…', { duration: 0 });
    try {
      const res = await calendarApi.sync();
      toast.dismiss(loadingId);
      if (res.success) {
        await fetchTasks();
        toast.success(`Calendar synced! ${res.eventsSynced ?? ''} event(s).`);
      } else {
        toast.warning(res.message || 'Sync returned no changes');
      }
    } catch (err) {
      console.error('Calendar sync failed:', err);
      toast.dismiss(loadingId);
      toast.error(err.message || 'Calendar sync failed. Connect Google Calendar in your account.');
    } finally {
      setIsSyncing(false);
    }
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
    if (dayData?.date) setHighlightDate(dayData.date);
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
      const dueDate = new Date(`${taskData.date}T${taskData.startTime || '00:00'}:00`);
      
      if (isNew) {
        await api.post('/tasks', {
          title: taskData.title,
          description: taskData.description,
          householdId: user.householdId,
          createdById: user.id,
          assignedToId: user.id,
          dueDate: dueDate.toISOString(),
        });
      } else {
        await api.put(`/tasks/${taskData.id}`, {
          title: taskData.title,
          description: taskData.description,
          dueDate: dueDate.toISOString(),
        });
      }
      await fetchTasks();
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleToggleDone = async (taskId) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        if (!task.done) {
          await api.patch(`/tasks/${taskId}/complete`, { userId: user.id });
        } else {
          // If un-toggling done, backend needs a PUT to reset status
          await api.put(`/tasks/${taskId}`, { status: 'IN_PROGRESS' });
        }
        await fetchTasks();
      }
    } catch (err) {
      console.error('Failed to toggle task done:', err);
    }
  };

  const handleSavePerm = async (schedule) => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentYear, currentMonth, d);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      if (schedule.days.includes(dayName)) {
        const dateStr = date.toISOString().split('T')[0];
        const dueDate = new Date(`${dateStr}T${schedule.startTime || '00:00'}:00`);
        
        try {
          await api.post('/tasks', {
            title: schedule.title,
            description: 'Permanent schedule',
            householdId: user.householdId,
            createdById: user.id,
            assignedToId: user.id,
            dueDate: dueDate.toISOString(),
          });
        } catch (err) {
          console.error('Failed to save permanent task:', err);
        }
      }
    }
    await fetchTasks();
  };

  const handleCreateGroup = async (group) => {
    try {
      const data = await households.create({ name: group.name, createdById: user.id });
      if (data.success) {
        const newGroup = data.household;
        if (!newGroup.members) {
          newGroup.members = [{ id: user.id }];
        }
        setGroups([newGroup]); // Since user can only have one household, replace prev
        setCreateGroupModal(false);
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const handleJoinGroup = async (code) => {
    const trimmed = (code || '').trim();
    if (!trimmed) {
      toast.error('Please enter an invite code.');
      return;
    }
    try {
      const data = await households.join({ inviteCode: trimmed, userId: user?.id });
      const joinedId = data?.householdId;
      if (!joinedId) throw new Error(data?.error || 'Invalid invite code');

      // Update auth context so the rest of the app knows we have a household.
      if (user) {
        const next = { ...user, householdId: joinedId };
        login(next);
      }

      // Refresh the visible group so the user can see the household they joined.
      try {
        const resp = await households.getById(joinedId);
        // Backend returns { success, household }. Older callers used the bare
        // household, so accept both shapes defensively.
        const fresh = resp?.household ?? resp;
        if (fresh && fresh.id) {
          setGroups([{
            ...fresh,
            name: fresh.name || data?.householdName || 'Household',
            members: Array.isArray(fresh.members) ? fresh.members : [],
          }]);
        }
      } catch (e) {
        console.warn('Could not load joined household details:', e);
      }

      toast.success(data.householdName ? `Joined "${data.householdName}"!` : 'Joined household!');
      setJoinGroupModal(false);
    } catch (err) {
      console.error('Join household failed:', err);
      toast.error(err?.message || 'Invalid invite code');
    }
  };

  const selectedDayTasks = useMemo(() => {
    if (!selectedDay?.date) return [];
    return tasks.filter(t => t.date === selectedDay.date);
  }, [selectedDay, tasks]);

  const nameStr = user?.name || 'Alex Popescu';
  const nameParts = nameStr.split(' ');
  const initials = `${nameParts[0]?.[0] || ''}${nameParts[1]?.[0] || ''}`.toUpperCase() || 'AP';

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
        <button className="calendar-page__perm-btn" onClick={handleSyncCalendar} disabled={isSyncing}>
          {isSyncing ? '🔄 Syncing...' : '🔄 Sync Calendar'}
        </button>
      </div>

      {/* Calendar grid + day preview (click a day to open) */}
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
                  <button
                    key={task.id}
                    className="calendar-page__task-item"
                    onClick={() => handleEditTask(task)}
                    style={{ borderLeftColor: task.color }}
                  >
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
