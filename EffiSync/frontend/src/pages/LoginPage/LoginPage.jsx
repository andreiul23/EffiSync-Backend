import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth, demo } from '../../services/api';
import { useToast } from '../../components/Toast/ToastProvider';
import Aurora from '../../components/Aurora/Aurora';
import AuthCard from '../../components/AuthCard/AuthCard';
import SocialButton from '../../components/SocialButton/SocialButton';
import './LoginPage.scss';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/groups';
  const { login } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email format';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    return errs;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      const data = await auth.login({ email: form.email, password: form.password });
      if (data.token) {
        localStorage.setItem('effisync_jwt', data.token);
      }
      // Prefer the full user object returned by the backend
      const u = data.user || { id: data.userId, email: form.email, householdId: data.householdId ?? null };
      login(u);
      toast.success(`Welcome back${u.name ? `, ${u.name.split(' ')[0]}` : ''}!`);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const msg = error?.message || 'Login failed. Please try again.';
      // Backend tells us when an account is OAuth-only (Google / GitHub)
      const isOAuthOnly = /created with (google|github)/i.test(msg);
      const looksLikeGmail = /@gmail\.com\s*$/i.test(form.email);
      if (isOAuthOnly || looksLikeGmail) {
        toast.error('This email uses Google sign-in. Use “Continue with Google” above.');
        setErrors({ email: 'Use “Continue with Google” for this account.' });
      } else {
        toast.error(msg);
        setErrors({ email: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const data = await demo.login();
      if (!data.success || !data.token) throw new Error(data.message || 'Demo login failed');
      localStorage.setItem('effisync_jwt', data.token);
      login(data.user);
      toast.success(data.message || 'Demo loaded!');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      toast.error(error.message || 'Could not start the demo. Try again.');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = auth.googleLoginUrl();
  };

  const handleGithubLogin = () => {
    window.location.href = auth.githubLoginUrl();
  };

  return (
    <div className="login-page">
      <div className="login-page__aurora-bg">
        <Aurora colorStops={['#5D0E66', '#904399', '#F9C7FF']} amplitude={1.2} blend={0.6} speed={0.8} />
      </div>
      <Link to="/" className="login-page__back-btn">← Back to Home</Link>
      <div className="login-page__container">
        <AuthCard title="Welcome back" subtitle="Log in to continue to EffiSync">
          <div className="login-page__socials">
            <SocialButton provider="google" onClick={handleGoogleLogin} />
            <SocialButton provider="github" onClick={handleGithubLogin} />
          </div>

          <button
            type="button"
            className="login-page__demo-btn"
            onClick={handleDemoLogin}
            disabled={demoLoading}
          >
            {demoLoading ? 'Loading demo…' : '✨ Try Live Demo (no signup)'}
          </button>

          <div className="login-page__divider">
            <span>or continue with email</span>
          </div>

          <form className="login-page__form" onSubmit={handleSubmit} noValidate>
            <div className="login-page__field">
              <label className="login-page__label" htmlFor="login-email">Email</label>
              <input
                className={`login-page__input ${errors.email ? 'login-page__input--error' : ''}`}
                id="login-email" type="email" name="email"
                placeholder="you@example.com" value={form.email}
                onChange={handleChange} autoComplete="email"
                required aria-required="true"
                aria-invalid={!!errors.email}
              />
              {errors.email && <span className="login-page__error">{errors.email}</span>}
            </div>

            <div className="login-page__field">
              <label className="login-page__label" htmlFor="login-password">Password</label>
              <input
                className={`login-page__input ${errors.password ? 'login-page__input--error' : ''}`}
                id="login-password" type="password" name="password"
                placeholder="••••••••" value={form.password}
                onChange={handleChange} autoComplete="current-password"
                required aria-required="true"
                aria-invalid={!!errors.password}
              />
              {errors.password && <span className="login-page__error">{errors.password}</span>}
            </div>

            <button type="submit" className="login-page__submit" disabled={loading} aria-busy={loading}>
              {loading ? 'Logging in…' : 'LOG IN'}
            </button>
          </form>

          <p className="login-page__footer-text">
            Don't have an account?{' '}
            <Link to="/signup" className="login-page__link">Sign up</Link>
          </p>
        </AuthCard>
      </div>
    </div>
  );
}

export default LoginPage;
