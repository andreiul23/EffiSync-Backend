import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from './layout/Layout';
import HomePage from './pages/HomePage/HomePage';
import LoginPage from './pages/LoginPage/LoginPage';
import SignupPage from './pages/SignupPage/SignupPage';
import CalendarPage from './pages/CalendarPage/CalendarPage';
import GroupsPage from './pages/GroupsPage/GroupsPage';
import AccountPage from './pages/AccountPage/AccountPage';
import { useAuth } from './context/AuthContext';

function DashboardRedirect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      // Store token securely
      localStorage.setItem('effisync_jwt', token);
      
      // Clean URL
      window.history.replaceState({}, document.title, '/groups');

      // Fetch user data
      fetch('http://localhost:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            login(data.user);
            navigate('/groups');
          } else {
            navigate('/login?error=oauth_failed');
          }
        })
        .catch(() => navigate('/login?error=oauth_failed'));
    } else {
      navigate('/groups');
    }
  }, [token, login, navigate]);

  return <div style={{ padding: '2rem', textAlign: 'center' }}>Authenticating...</div>;
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
