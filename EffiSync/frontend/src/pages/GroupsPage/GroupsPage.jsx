import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { tasks as tasksApi } from '../../services/api';
import GroupCalendar from '../../components/GroupCalendar/GroupCalendar';
import GroupTaskList from '../../components/GroupTaskList/GroupTaskList';
import MembersList from '../../components/MembersList/MembersList';
import AiTaskSuggestionModal from '../../components/AiTaskSuggestionModal/AiTaskSuggestionModal';
import AddGroupTaskModal from '../../components/AddGroupTaskModal/AddGroupTaskModal';
import MemberProfileModal from '../../components/MemberProfileModal/MemberProfileModal';
import JoinHousehold from '../../components/JoinHousehold/JoinHousehold';
import './GroupsPage.scss';

function GroupsPage() {
  const { user } = useAuth();

  // ── Household guard ──────────────────────────────────────
  if (!user?.householdId) {
    return <JoinHousehold />;
  }

  return <GroupsDashboard user={user} />;
}

function GroupsDashboard({ user }) {
  const [groupTasks, setGroupTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [householdName, setHouseholdName] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberProfile, setShowMemberProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completingTaskId, setCompletingTaskId] = useState(null);

  // Fetch household data + tasks on mount
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Tasks for this household
        const taskData = await tasksApi.list({ householdId: user.householdId });
        setGroupTasks(taskData.tasks || []);

        // Household details (members + name)
        const res = await fetch(`http://localhost:3000/api/households/${user.householdId}`);
        const hData = await res.json();
        if (hData.success) {
          setHouseholdName(hData.household.name);
          setMembers(hData.household.members || []);
        }
      } catch (err) {
        console.error('Failed to fetch household data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user.householdId]);

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setShowAiModal(true);
  };

  const handleAcceptTask = async (task) => {
    try {
      const data = await tasksApi.accept(task.id, { userId: user.id });
      setGroupTasks(prev => prev.map(t => t.id === task.id ? data.task : t));
    } catch (err) {
      console.error('Failed to accept task:', err);
    }
  };

  const handleRefuseTask = async (task) => {
    try {
      const data = await tasksApi.veto(task.id, { userId: user.id });
      setGroupTasks(prev => prev.map(t => t.id === task.id ? data.task : t));
    } catch (err) {
      console.error('Failed to veto task:', err);
    }
  };

  // ── Task Completion Flow ─────────────────────────────────
  const handleCompleteTask = async (taskId) => {
    setCompletingTaskId(taskId);
    try {
      const res = await fetch(`http://localhost:3000/api/tasks/${taskId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGroupTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
    } catch (err) {
      console.error('Failed to complete task:', err);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleAddTask = async (taskData) => {
    try {
      const data = await tasksApi.create({
        ...taskData,
        householdId: user.householdId,
        createdById: user.id,
      });
      setGroupTasks(prev => [...prev, data.task]);
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleMemberClick = (member) => {
    setSelectedMember(member);
    setShowMemberProfile(true);
  };

  const currentGroup = {
    id: user.householdId,
    name: householdName,
    userPoints: members.find(m => m.id === user.id)?.groupPoints ?? members.find(m => m.id === user.id)?.pointsBalance ?? 0
  };
  const userPoints = currentGroup.userPoints;
  // Tasks assigned to current user that are in progress = show completion UI
  const myActiveTasks = groupTasks.filter(
    t => t.assignedToId === user.id && t.status === 'IN_PROGRESS'
  );

  if (loading) {
    return (
      <div className="groups-page groups-page--loading">
        <div className="groups-page__spinner" />
        <p>Loading household…</p>
      </div>
    );
  }

  return (
    <div className="groups-page">
      <div className="groups-page__header">
        <h1 className="groups-page__title">{householdName || 'My Group'}</h1>
        <span className="groups-page__subtitle">Group calendar &amp; tasks</span>
      </div>

      {/* My tasks needing completion */}
      {myActiveTasks.length > 0 && (
        <div className="groups-page__my-tasks">
          <h3 className="groups-page__my-tasks-title">✅ Tasks assigned to you</h3>
          <div className="groups-page__my-tasks-list">
            {myActiveTasks.map(task => (
              <div key={task.id} className="groups-page__my-task-card">
                <div>
                  <strong>{task.title}</strong>
                  <span className="groups-page__my-task-pts">{task.pointsValue} pts</span>
                </div>
                <div className="groups-page__my-task-actions">
                  <button
                    className="groups-page__btn-complete"
                    onClick={() => handleCompleteTask(task.id)}
                    disabled={completingTaskId === task.id}
                  >
                    {completingTaskId === task.id ? '…' : 'Confirm Completion'}
                  </button>
                  <button
                    className="groups-page__btn-refuse"
                    onClick={() => handleRefuseTask(task)}
                  >
                    Use Veto
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="groups-page__content">
        <div className="groups-page__sidebar groups-page__sidebar--left">
          <GroupTaskList tasks={groupTasks} onTaskClick={handleTaskClick} currentUserId={user.id} />
        </div>
        <div className="groups-page__main">
          <GroupCalendar groupTasks={groupTasks} members={members} />
        </div>
        <div className="groups-page__sidebar groups-page__sidebar--right">
          <MembersList members={members} onMemberClick={handleMemberClick} />
          <div className="groups-page__points">
            <span className="groups-page__points-label">Your points</span>
            <span className="groups-page__points-value">{userPoints}</span>
          </div>
        </div>
      </div>

      <button className="groups-page__fab" onClick={() => setShowAddTask(true)}>+</button>

      <AiTaskSuggestionModal
        isOpen={showAiModal}
        onClose={() => { setShowAiModal(false); setSelectedTask(null); }}
        task={selectedTask}
        userPoints={userPoints}
        onAccept={handleAcceptTask}
        onRefuse={handleRefuseTask}
      />
      <AddGroupTaskModal isOpen={showAddTask} onClose={() => setShowAddTask(false)} onAdd={handleAddTask} />
      <MemberProfileModal
        isOpen={showMemberProfile}
        onClose={() => { setShowMemberProfile(false); setSelectedMember(null); }}
        member={selectedMember}
      />
    </div>
  );
}

export default GroupsPage;
