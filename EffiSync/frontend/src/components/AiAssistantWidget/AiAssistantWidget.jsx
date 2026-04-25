import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { mockAiConversations } from '../../mockData';
import './AiAssistantWidget.scss';

function AiAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState(mockAiConversations);
  const [activeConvId, setActiveConvId] = useState(mockAiConversations[0]?.id);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await api.get('/chat/history');
        if (history && history.length > 0) {
          const isFlatArray = Array.isArray(history) && (history.length === 0 || history[0].role);
          if (isFlatArray) {
            const convId = 'conv-history';
            setConversations([{ id: convId, title: 'Chat History', date: 'Previous', messages: history }]);
            setActiveConvId(convId);
          } else {
            setConversations(history);
            setActiveConvId(history[0]?.id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
      }
    };
    fetchHistory();
  }, []);

  const activeConv = conversations.find(c => c.id === activeConvId);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg = { role: 'user', text: inputValue };
    const loadingMsg = { role: 'assistant', text: 'AI is thinking...', isLoading: true };

    setConversations(prev =>
      prev.map(c =>
        c.id === activeConvId
          ? { ...c, messages: [...c.messages, userMsg, loadingMsg] }
          : c
      )
    );
    
    const sentValue = inputValue;
    setInputValue('');

    try {
      const response = await api.post('/chat', { message: sentValue });
      setConversations(prev =>
        prev.map(c =>
          c.id === activeConvId
            ? {
                ...c,
                messages: c.messages.map(m => 
                  m.isLoading 
                    ? { role: 'assistant', text: response.reply || response.text || response.message || 'Done' } 
                    : m
                )
              }
            : c
        )
      );
    } catch (err) {
      setConversations(prev =>
        prev.map(c =>
          c.id === activeConvId
            ? {
                ...c,
                messages: c.messages.map(m => 
                  m.isLoading 
                    ? { role: 'assistant', text: 'Sorry, I encountered an error connecting to the server.' } 
                    : m
                )
              }
            : c
        )
      );
    }
  };

  const handleNewConv = () => {
    const newConv = {
      id: `conv-${Date.now()}`,
      title: 'New conversation',
      date: 'Just now',
      messages: [
        { role: 'assistant', text: "Hi! I'm your EffiSync AI assistant. How can I help optimize your schedule today?" },
      ],
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConvId(newConv.id);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        className={`ai-widget-btn ${isOpen ? 'ai-widget-btn--active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="AI Assistant"
      >
        <span className="ai-widget-btn__icon">
          {isOpen ? '✕' : '✨'}
        </span>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="ai-panel">
          <div className="ai-panel__main">
            <div className="ai-panel__header">
              <div className="ai-panel__header-info">
                <span className="ai-panel__header-icon">🤖</span>
                <div>
                  <h3 className="ai-panel__header-title">EffiSync AI</h3>
                  <span className="ai-panel__header-status">Online</span>
                </div>
              </div>
            </div>

            <div className="ai-panel__messages">
              {activeConv?.messages.map((msg, i) => (
                <div key={i} className={`ai-panel__msg ai-panel__msg--${msg.role}`}>
                  {msg.role === 'assistant' && (
                    <span className="ai-panel__msg-avatar">🤖</span>
                  )}
                  <div className="ai-panel__msg-bubble">
                    {msg.text.split('\n').map((line, j) => (
                      <span key={j}>{line}<br/></span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="ai-panel__input-area">
              <input
                className="ai-panel__input"
                type="text"
                placeholder="Ask EffiSync AI..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button className="ai-panel__send" onClick={handleSend}>
                ➤
              </button>
            </div>
          </div>

          <div className="ai-panel__sidebar">
            <div className="ai-panel__sidebar-header">
              <h4>Conversations</h4>
              <button className="ai-panel__new-conv" onClick={handleNewConv}>+</button>
            </div>
            <div className="ai-panel__conv-list">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  className={`ai-panel__conv ${conv.id === activeConvId ? 'ai-panel__conv--active' : ''}`}
                  onClick={() => setActiveConvId(conv.id)}
                >
                  <span className="ai-panel__conv-title">{conv.title}</span>
                  <span className="ai-panel__conv-date">{conv.date}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AiAssistantWidget;
