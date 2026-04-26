import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Gate for authenticated-only pages.
 * If the user isn't logged in, redirect to /login while preserving
 * the intended destination so we can bounce back after sign-in.
 */
function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

/**
 * Inverse gate for /login and /signup: if the user is already
 * authenticated, kick them to /groups instead of letting them
 * bounce around auth screens.
 */
export function PublicOnlyRoute({ children }) {
  const { isLoggedIn } = useAuth();
  if (isLoggedIn) return <Navigate to="/groups" replace />;
  return children;
}

export default ProtectedRoute;
