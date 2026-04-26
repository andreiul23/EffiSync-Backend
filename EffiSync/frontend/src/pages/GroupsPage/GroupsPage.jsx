import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { debug, households, tasks as tasksApi } from '../../services/api';
import GroupCalendar from '../../components/GroupCalendar/GroupCalendar';
import GroupTaskList from '../../components/GroupTaskList/GroupTaskList';
import MembersList from '../../components/MembersList/MembersList';
import AiTaskSuggestionModal from '../../components/AiTaskSuggestionModal/AiTaskSuggestionModal';
import AddGroupTaskModal from '../../components/AddGroupTaskModal/AddGroupTaskModal';
import MemberProfileModal from '../../components/MemberProfileModal/MemberProfileModal';
import JoinHousehold from '../../components/JoinHousehold/JoinHousehold';
import { SkeletonList } from '../../components/Skeleton/Skeleton';
import { useToast } from '../../components/Toast/ToastProvider';
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
  const toast = useToast();
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
  const [rewards, setRewards] = useState([]);
  const [purchasingRewardId, setPurchasingRewardId] = useState(null);
  const shopRef = useRef(null);
  const [shopVisible, setShopVisible] = useState(false);

  // Hide FAB once Shop section enters the viewport.
  useEffect(() => {
    const el = shopRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => setShopVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rewards.length]);

  // Fetch household data + tasks on mount
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Tasks for this household
        const taskData = await tasksApi.list({ householdId: user.householdId, type: 'GROUP' });
        setGroupTasks(taskData.tasks || []);

        // Household details (members + name)
        const hData = await households.getById(user.householdId);
        if (hData.success) {
          setHouseholdName(hData.household.name);
          setMembers(hData.household.members || []);
        }

        // Shop catalog
        try {
          const sData = await households.shopList(user.householdId);
          if (sData.success) setRewards(sData.rewards || []);
        } catch (shopErr) {
          console.warn('Shop unavailable:', shopErr);
        }
      } catch (err) {
        console.error('Failed to fetch household data:', err);
        toast.error('Could not load household data.');
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
      
      if (task.aiSuggestedTime) {
        const [startStr] = task.aiSuggestedTime.split(' - ').map(s => s.trim());
        const dateObj = task.dueDate ? new Date(task.dueDate) : new Date();
        const [hour, min] = (startStr || '09:00').split(':');
        dateObj.setHours(parseInt(hour), parseInt(min), 0, 0);
        
        const updateRes = await tasksApi.update(task.id, { dueDate: dateObj.toISOString() });
        setGroupTasks(prev => prev.map(t => t.id === task.id ? updateRes.task : t));
      } else {
        setGroupTasks(prev => prev.map(t => t.id === task.id ? data.task : t));
      }
      toast.success(`Accepted: ${task.title}`);
    } catch (err) {
      console.error('Failed to accept task:', err);
      toast.error(err.message || 'Failed to accept task');
    }
  };

  const handleRefuseTask = async (task) => {
    try {
      const data = await tasksApi.veto(task.id, { userId: user.id });
      setGroupTasks(prev => prev.map(t => t.id === task.id ? data.task : t));
      toast.info(`Veto applied to ${task.title}`);
    } catch (err) {
      console.error('Failed to veto task:', err);
      toast.error(err.message || 'Veto failed (may be on cooldown)');
    }
  };

  // ── Task Completion Flow ─────────────────────────────────
  const handleCompleteTask = async (taskId) => {
    setCompletingTaskId(taskId);
    try {
      const data = await tasksApi.complete(taskId, { userId: user.id });
      setGroupTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
      setMembers(prev => prev.map(m => m.id === user.id ? { ...m, pointsBalance: (m.pointsBalance || 0) + data.task.pointsValue } : m));
      toast.success(`+${data.task.pointsValue} pts! Task completed 🎉`);
    } catch (err) {
      console.error('Failed to complete task:', err);
      toast.error(err.message || 'Failed to complete task');
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
      toast.success(`Created: ${data.task.title}`);
    } catch (err) {
      console.error('Failed to create task:', err);
      toast.error(err.message || 'Failed to create task');
    }
  };

  const handleMemberClick = (member) => {
    setSelectedMember(member);
    setShowMemberProfile(true);
  };

  const handlePurchase = async (reward) => {
    if (purchasingRewardId) return;
    if (userPoints < reward.price) {
      toast.error(`You need ${reward.price - userPoints} more points`);
      return;
    }
    setPurchasingRewardId(reward.id);
    try {
      const data = await households.shopPurchase(user.householdId, reward.id);
      if (data.success) {
        setMembers((prev) => prev.map((m) => (m.id === user.id ? { ...m, pointsBalance: data.newBalance } : m)));
        toast.success(`Unlocked: ${reward.title} (-${reward.price} pts)`);
      } else {
        toast.error(data.error || 'Purchase failed');
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      toast.error(err.message || 'Purchase failed');
    } finally {
      setPurchasingRewardId(null);
    }
  };

  const leaderboard = [...members].sort(
    (a, b) => (b.pointsBalance || 0) - (a.pointsBalance || 0)
  );

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
      <div className="groups-page">
        <div className="groups-page__header">
          <h1 className="groups-page__title">Loading household…</h1>
        </div>
        <div className="groups-page__content">
          <div className="groups-page__sidebar groups-page__sidebar--left">
            <SkeletonList count={4} />
          </div>
          <div className="groups-page__main">
            <SkeletonList count={3} />
          </div>
          <div className="groups-page__sidebar groups-page__sidebar--right">
            <SkeletonList count={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="groups-page">
      <div className="groups-page__header">
        <h1 className="groups-page__title">{householdName || 'My Group'}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="groups-page__subtitle">Group calendar &amp; tasks</span>
          <button 
            className="groups-page__btn-complete" 
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            onClick={async () => {
              const loadingId = toast.info('Generating AI report and sending emails…', { duration: 0 });
              try {
                await debug.triggerReport(user.householdId);
                toast.dismiss(loadingId);
                toast.success('AI Weekly Report generated and sent!');
              } catch (e) {
                console.error(e);
                toast.dismiss(loadingId);
                toast.error('Failed to generate report.');
              }
            }}
          >
            ✨ Generate AI Report
          </button>
        </div>
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
          <GroupTaskList tasks={groupTasks} onTaskClick={handleTaskClick} currentUserId={user.id} onCreateClick={() => setShowAddTask(true)} />
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

      <button
        className={`groups-page__fab${shopVisible ? ' groups-page__fab--hidden' : ''}`}
        onClick={() => setShowAddTask(true)}
      >+</button>

      {/* ── Shop ──────────────────────────────────────── */}
      {rewards.length > 0 && (
        <section ref={shopRef} className="groups-page__section groups-page__shop">
          <header className="groups-page__section-header">
            <h2 className="groups-page__section-title">🛍️ Shop</h2>
            <span className="groups-page__section-sub">Spend your hard-earned points</span>
          </header>
          <div className="groups-page__shop-grid">
            {rewards.map((r) => {
              const canAfford = userPoints >= r.price;
              const isBusy = purchasingRewardId === r.id;
              return (
                <article key={r.id} className={`reward-card${canAfford ? '' : ' reward-card--locked'}`}>
                  <div className="reward-card__icon" aria-hidden="true">{r.icon || '🎁'}</div>
                  <h3 className="reward-card__title">{r.title}</h3>
                  <p className="reward-card__desc">{r.description}</p>
                  <button
                    className="reward-card__buy"
                    onClick={() => handlePurchase(r)}
                    disabled={!canAfford || isBusy}
                  >
                    {isBusy ? '…' : `${r.price} pts`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Leaderboard ───────────────────────────────── */}
      {leaderboard.length > 0 && (
        <section className="groups-page__section groups-page__leaderboard">
          <header className="groups-page__section-header">
            <h2 className="groups-page__section-title">🏆 Leaderboard</h2>
            <span className="groups-page__section-sub">Top earners in {householdName || 'this group'}</span>
          </header>
          <ol className="leaderboard-list">
            {leaderboard.map((m, idx) => {
              const rank = idx + 1;
              const tier = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'rest';
              const isMe = m.id === user.id;
              return (
                <li key={m.id} className={`leaderboard-row leaderboard-row--${tier}${isMe ? ' leaderboard-row--me' : ''}`}>
                  <span className={`leaderboard-row__rank leaderboard-row__rank--${tier}`}>{rank}</span>
                  <span className="leaderboard-row__name">{m.name || m.email}{isMe && <em className="leaderboard-row__you"> (you)</em>}</span>
                  <span className="leaderboard-row__pts">{m.pointsBalance || 0} pts</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <AiTaskSuggestionModal
        isOpen={showAiModal}
        onClose={() => { setShowAiModal(false); setSelectedTask(null); }}
        task={selectedTask}
        userPoints={userPoints}
        onAccept={handleAcceptTask}
        onRefuse={handleRefuseTask}
      />
      <AddGroupTaskModal isOpen={showAddTask} onClose={() => setShowAddTask(false)} onAdd={handleAddTask} members={members} />
      <MemberProfileModal
        isOpen={showMemberProfile}
        onClose={() => { setShowMemberProfile(false); setSelectedMember(null); }}
        member={selectedMember}
      />
    </div>
  );
}

export default GroupsPage;
