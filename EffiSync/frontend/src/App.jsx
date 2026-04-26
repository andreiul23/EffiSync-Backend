import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from './layout/Layout';
import HomePage from './pages/HomePage/HomePage';
import { useAuth } from './context/AuthContext';
import { auth } from './services/api';
import ProtectedRoute, { PublicOnlyRoute } from './components/ProtectedRoute/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/LoginPage/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage/SignupPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage/CalendarPage'));
const GroupsPage = lazy(() => import('./pages/GroupsPage/GroupsPage'));
const AccountPage = lazy(() => import('./pages/AccountPage/AccountPage'));

function RouteLoader() {
  return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
}

function DashboardRedirect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const tokenFromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
  const token = tokenFromHash || searchParams.get('token');

  useEffect(() => {
    if (token) {
      // Store token securely
      localStorage.setItem('effisync_jwt', token);
      
      // Clean URL
      window.history.replaceState({}, document.title, '/groups');

      // Fetch user data
      auth.me()
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
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
          <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<DashboardRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default App;
