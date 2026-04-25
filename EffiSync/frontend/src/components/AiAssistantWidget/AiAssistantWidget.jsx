import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { useToast } from '../Toast/ToastProvider';
import './AiAssistantWidget.scss';

const STARTER_PROMPTS = [
  { icon: '📅', label: 'Plan my week',         prompt: 'Plan my week balancing chores and personal time. Suggest a fair distribution across our household.' },
  { icon: '⚖️', label: 'Split chores fairly',  prompt: 'Look at all open household tasks and assign them fairly based on points and current load.' },
  { icon: '⏰', label: "What's overdue?",       prompt: 'List my overdue and upcoming tasks for today. Prioritize them and tell me what to do first.' },
  { icon: '✨', label: 'Suggest growth time',  prompt: 'Find me a free 60-minute slot today for personal growth and recommend an activity.' },
];

const TOOL_LABELS = {
  get_household_state:        { icon: '🏠', label: 'Read household state' },
  sync_with_household:        { icon: '🔄', label: 'Sync household availability' },
  recommend_growth_activity:  { icon: '🌱', label: 'Recommend growth activity' },
  veto_task:                  { icon: '🚫', label: 'Apply veto' },
  check_calendar_availability:{ icon: '📅', label: 'Check calendar' },
  manage_task:                { icon: '📝', label: 'Manage task' },
  calculate_fair_assignment:  { icon: '⚖️', label: 'Calculate fair assignment' },
};

function describeToolResult(toolName, output) {
  if (!output) return null;
  if (output.error) return `Error: ${output.error}`;

  if (toolName === 'manage_task' && output.task && output.success) {
    return `Task: "${output.task.title}" (${output.task.pointsValue} pts)`;
  }
  if (toolName === 'veto_task' && output.success) {
    return output.message || 'Veto applied';
  }
  if (toolName === 'calculate_fair_assignment' && output.recommendation) {
    return `Best fit: ${output.recommendation.name} (load ${output.recommendation.loadScore})`;
  }
  if (toolName === 'sync_with_household' && Array.isArray(output)) {
    return `${output.length} member(s) checked`;
  }
  if (toolName === 'get_household_state' && output.tasks) {
    return `${output.tasks.length} tasks · ${output.members?.length ?? 0} members`;
  }
  if (typeof output.message === 'string') return output.message;
  return null;
}

function ToolStep({ step, index }) {
  const [open, setOpen] = useState(false);
  if (!step.toolCalls?.length) return null;

  return (
    <div className="ai-tool-step">
      <button className="ai-tool-step__header" onClick={() => setOpen((v) => !v)} type="button">
        <span className="ai-tool-step__badge">Step {index + 1}</span>
        <span className="ai-tool-step__chips">
          {step.toolCalls.map((tc, i) => {
            const meta = TOOL_LABELS[tc.tool] || { icon: '🔧', label: tc.tool };
            return (
              <span key={i} className="ai-tool-chip">
                <span className="ai-tool-chip__icon">{meta.icon}</span>
                <span className="ai-tool-chip__label">{meta.label}</span>
              </span>
            );
          })}
        </span>
        <span className="ai-tool-step__caret">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="ai-tool-step__body">
          {step.toolResults?.map((tr, i) => {
            const summary = describeToolResult(tr.tool, tr.output);
            return (
              <div key={i} className="ai-tool-step__result">
                <span className="ai-tool-step__result-label">
                  {TOOL_LABELS[tr.tool]?.label || tr.tool}:
                </span>{' '}
                {summary ?? <code>{JSON.stringify(tr.output).slice(0, 220)}</code>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }) {
  if (msg.isLoading) {
    return (
      <div className="ai-panel__msg ai-panel__msg--assistant">
        <span className="ai-panel__msg-avatar">🤖</span>
        <div className="ai-panel__msg-bubble ai-panel__msg-bubble--loading">
          <span className="ai-typing"><i /><i /><i /></span>
        </div>
      </div>
    );
  }

  return (
    <div className={`ai-panel__msg ai-panel__msg--${msg.role}`}>
      {msg.role === 'assistant' && <span className="ai-panel__msg-avatar">🤖</span>}
      <div className="ai-panel__msg-content">
        <div className="ai-panel__msg-bubble">
          {(msg.text || '').split('\n').map((line, j) => (
            <span key={j}>{line}<br/></span>
          ))}
        </div>
        {msg.steps && msg.steps.length > 0 && (
          <div className="ai-panel__steps">
            {msg.steps
              .filter((s) => s.toolCalls?.length)
              .map((s, i) => <ToolStep key={i} step={s} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function AiAssistantWidget() {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your EffiSync AI. I can plan your week, split chores fairly, and coordinate your household. What can I help with?" },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isOpen || historyLoaded) return;
    setHistoryLoaded(true);
    api
      .get('/chat/history')
      .then((res) => {
        const list = res?.messages || res || [];
        if (Array.isArray(list) && list.length > 0) {
          const mapped = list.map((m) => ({
            role: m.role === 'AI' ? 'assistant' : 'user',
            text: m.text,
          }));
          setMessages([
            { role: 'assistant', text: 'Welcome back! Picking up where we left off.' },
            ...mapped,
          ]);
        }
      })
      .catch(() => { /* keep welcome state */ });
  }, [isOpen, historyLoaded]);

  const sendMessage = async (text) => {
    const trimmed = (text ?? inputValue).trim();
    if (!trimmed || sending) return;

    setInputValue('');
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: trimmed },
      { role: 'assistant', text: '', isLoading: true },
    ]);

    try {
      const data = await api.post('/chat', { message: trimmed });
      const replyText = data.response || data.reply || data.text || data.message || 'Done.';
      const steps = Array.isArray(data.steps) ? data.steps : [];

      setMessages((prev) => {
        const next = [...prev];
        const idx = next.findIndex((m) => m.isLoading);
        if (idx !== -1) next[idx] = { role: 'assistant', text: replyText, steps };
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.findIndex((m) => m.isLoading);
        if (idx !== -1) next[idx] = { role: 'assistant', text: 'Sorry, I hit an error. Mind trying again?' };
        return next;
      });
      toast.error(err.message || 'AI request failed');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmpty = messages.length <= 1;

  return (
    <>
      <button
        className={`ai-widget-btn ${isOpen ? 'ai-widget-btn--active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="AI Assistant"
      >
        <span className="ai-widget-btn__icon">{isOpen ? '✕' : '✨'}</span>
      </button>

      {isOpen && (
        <div className="ai-panel">
          <div className="ai-panel__main">
            <div className="ai-panel__header">
              <div className="ai-panel__header-info">
                <span className="ai-panel__header-icon">🤖</span>
                <div>
                  <h3 className="ai-panel__header-title">EffiSync AI</h3>
                  <span className="ai-panel__header-status">
                    <span className="ai-panel__pulse" /> Online
                  </span>
                </div>
              </div>
              <button
                className="ai-panel__close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="ai-panel__messages">
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              <div ref={messagesEndRef} />

              {isEmpty && (
                <div className="ai-starters">
                  <p className="ai-starters__label">Try one of these:</p>
                  <div className="ai-starters__grid">
                    {STARTER_PROMPTS.map((s) => (
                      <button
                        key={s.label}
                        className="ai-starter"
                        onClick={() => sendMessage(s.prompt)}
                        disabled={sending}
                        type="button"
                      >
                        <span className="ai-starter__icon">{s.icon}</span>
                        <span className="ai-starter__label">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="ai-panel__input-area">
              <input
                className="ai-panel__input"
                type="text"
                placeholder={sending ? 'Thinking…' : 'Ask EffiSync AI…'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
              />
              <button
                className="ai-panel__send"
                onClick={() => sendMessage()}
                disabled={sending || !inputValue.trim()}
                aria-label="Send"
                type="button"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AiAssistantWidget;
