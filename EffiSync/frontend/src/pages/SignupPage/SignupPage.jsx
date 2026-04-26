import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../services/api';
import Aurora from '../../components/Aurora/Aurora';
import AuthCard from '../../components/AuthCard/AuthCard';
import { useToast } from '../../components/Toast/ToastProvider';
import './SignupPage.scss';

function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '',
    email: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim())  errs.lastName  = 'Last name is required';
    if (!form.email.trim())     errs.email     = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email format';
    if (!form.password)         errs.password  = 'Password is required';
    else if (form.password.length < 6) errs.password = 'Minimum 6 characters';
    if (!form.confirmPassword)  errs.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
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
      const data = await auth.register({
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        password: form.password,
      });
      // data = { success: true, userId: "..." }
      if (data.token) {
        localStorage.setItem('effisync_jwt', data.token);
      }
      signup({
        id: data.userId,
        email: form.email,
        name: `${form.firstName} ${form.lastName}`.trim(),
        householdId: null, // new users always start with no household
      });
      toast.success('Account created! Welcome to EffiSync 🎉');
      navigate('/groups'); // will show JoinHousehold guard
    } catch (error) {
      setErrors({ email: error.message || 'Registration failed. Please try again.' });
      toast.error(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const renderField = (name, label, type = 'text', placeholder = '') => (
    <div className="signup-page__field">
      <label className="signup-page__label" htmlFor={`signup-${name}`}>{label}</label>
      <input
        className={`signup-page__input ${errors[name] ? 'signup-page__input--error' : ''}`}
        id={`signup-${name}`} type={type} name={name}
        placeholder={placeholder} value={form[name]}
        onChange={handleChange}
        autoComplete={name === 'confirmPassword' ? 'new-password' : name}
        required aria-required="true"
        aria-invalid={!!errors[name]}
      />
      {errors[name] && <span className="signup-page__error">{errors[name]}</span>}
    </div>
  );

  return (
    <div className="signup-page">
      <div className="signup-page__aurora-bg">
        <Aurora colorStops={['#904399', '#F9C7FF', '#5D0E66']} amplitude={1.0} blend={0.5} speed={0.6} />
      </div>
      <Link to="/" className="signup-page__back-btn">← Back to Home</Link>
      <div className="signup-page__container">
        <AuthCard title="Create account" subtitle="Join EffiSync and take control of your time">
          <form className="signup-page__form" onSubmit={handleSubmit} noValidate>
            <div className="signup-page__row">
              {renderField('firstName', 'First name', 'text', 'John')}
              {renderField('lastName',  'Last name',  'text', 'Doe')}
            </div>
            {renderField('phone',           'Phone',            'tel',      '+40 7XX XXX XXX')}
            {renderField('email',           'Email',            'email',    'you@example.com')}
            {renderField('password',        'Password',         'password', '••••••••')}
            {renderField('confirmPassword', 'Confirm password', 'password', '••••••••')}

            <button type="submit" className="signup-page__submit" disabled={loading} aria-busy={loading}>
              {loading ? 'Creating account…' : 'SIGN UP'}
            </button>
          </form>

          <p className="signup-page__footer-text">
            Already have an account?{' '}
            <Link to="/login" className="signup-page__link">Log in</Link>
          </p>
        </AuthCard>
      </div>
    </div>
  );
}

export default SignupPage;
