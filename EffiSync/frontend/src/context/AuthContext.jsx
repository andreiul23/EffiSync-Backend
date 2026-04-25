import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ai, auth as authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() =>
    localStorage.getItem('effisync_logged_in') === 'true'
  );
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('effisync_user');
    return saved ? JSON.parse(saved) : null;
  });
  // AI initialization state
  const [aiReady, setAiReady] = useState(false);
  const [aiMessage, setAiMessage] = useState(null);

  useEffect(() => {
    localStorage.setItem('effisync_logged_in', isLoggedIn);
    if (isLoggedIn && user) {
      localStorage.setItem('effisync_user', JSON.stringify(user));
    } else if (!isLoggedIn) {
      localStorage.removeItem('effisync_user');
    }
  }, [isLoggedIn, user]);

  // Call AI initialize once after login
  useEffect(() => {
    if (!isLoggedIn || !user?.id || aiReady) return;

    ai.initialize()
      .then(data => {
        if (data.success) {
          setAiReady(true);
          setAiMessage(data.message);
          // Update householdId if returned
          if (data.user?.householdId) {
            setUser(prev => ({ ...prev, householdId: data.user.householdId }));
          }
        }
      })
      .catch(err => console.warn('AI init failed (non-critical):', err));
  }, [isLoggedIn, user?.id, aiReady]);

  const login = useCallback((userData) => {
    // userData must contain at minimum: { id, email, householdId? }
    setUser(userData);
    setIsLoggedIn(true);
    setAiReady(false); // reset so init runs again
    setAiMessage(null);
  }, []);

  const signup = useCallback((userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    setAiReady(false);
    setAiMessage(null);
  }, []);

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    setUser(null);
    setAiReady(false);
    setAiMessage(null);
    localStorage.removeItem('effisync_user');
    localStorage.removeItem('effisync_logged_in');
    localStorage.removeItem('effisync_jwt');
    localStorage.removeItem('token');
  }, []);

  const clearAiMessage = useCallback(() => setAiMessage(null), []);

  return (
    <AuthContext.Provider value={{
      isLoggedIn, user, login, signup, logout,
      aiReady, aiMessage, clearAiMessage,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
