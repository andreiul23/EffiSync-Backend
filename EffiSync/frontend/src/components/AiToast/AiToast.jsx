import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './AiToast.scss';

/**
 * Displays the AI ready notification once after login.
 * Auto-dismisses after 5 seconds.
 */
function AiToast() {
  const { aiMessage, clearAiMessage } = useAuth();

  useEffect(() => {
    if (!aiMessage) return;
    const timer = setTimeout(clearAiMessage, 5000);
    return () => clearTimeout(timer);
  }, [aiMessage, clearAiMessage]);

  if (!aiMessage) return null;

  return (
    <div className="ai-toast" onClick={clearAiMessage}>
      <span className="ai-toast__icon">🤖</span>
      <span className="ai-toast__text">{aiMessage}</span>
      <button className="ai-toast__close" aria-label="Dismiss">×</button>
    </div>
  );
}

export default AiToast;
