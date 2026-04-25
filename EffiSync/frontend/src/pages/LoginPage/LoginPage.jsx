import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../services/api';
import Aurora from '../../components/Aurora/Aurora';
import AuthCard from '../../components/AuthCard/AuthCard';
import SocialButton from '../../components/SocialButton/SocialButton';
import './LoginPage.scss';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

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
      // data = { success: true, userId: "..." }
      login({ id: data.userId, email: form.email, householdId: data.householdId ?? null });
      navigate('/groups');
    } catch (error) {
      setErrors({ email: error.message || 'Login failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:3000/api/auth/google';
  };

  const handleGithubLogin = () => {
    window.location.href = 'http://localhost:3000/api/auth/github';
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
              />
              {errors.password && <span className="login-page__error">{errors.password}</span>}
            </div>

            <button type="submit" className="login-page__submit" disabled={loading}>
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
