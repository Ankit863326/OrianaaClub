// Phase 1: Let a member with a valid reset token choose a new password.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import loginBg from '../../assets/Member login clean.png';
import apiClient from '../../lib/apiClient.js';
import '../LoginPage/LoginPage.css';
import './ResetPassword.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(token ? '' : 'This password reset link is missing or invalid. Request a new link.');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/auth/reset-password', { token, password, confirmPassword });
      navigate('/login', { replace: true, state: { message: 'Your password has been reset. You can now log in.' } });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page auth-page">
      <div className="login-page__bg" style={{ backgroundImage: `url("${loginBg}")` }} />
      <div className="login-page__vignette" />
      <div className="login-page__container">
        <div className="login-page__left-spacer" />
        <section className="login-form-panel">
          <div className="login-form-inner">
            <header className="login-header">
              <h1 className="login-title">Reset Password</h1>
              <p className="login-subtitle">Choose a new secure password for your account.</p>
            </header>
            {error && <p className="auth-form-error" role="alert">{error}</p>}
            {token && (
              <form className="login-form" onSubmit={handleSubmit}>
                <div className="login-field">
                  <label className="login-label" htmlFor="reset-password">New password</label>
                  <div className="login-input-wrapper">
                    <input className="login-input" id="reset-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} />
                    <button className="login-toggle-password" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <span className="auth-password-hint">Use at least 8 characters with uppercase, lowercase, and a number.</span>
                </div>
                <div className="login-field">
                  <label className="login-label" htmlFor="reset-confirm-password">Confirm new password</label>
                  <div className="login-input-wrapper">
                    <input className="login-input" id="reset-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength="8" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  </div>
                </div>
                <button className="login-submit-btn" type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Reset Password'}</button>
              </form>
            )}
            {!token && <div className="login-footer-prompt"><Link className="login-register-link" to="/forgot-password">Request a new reset link</Link></div>}
            {token && (
              <div className="login-footer-prompt">
                <Link className="login-register-link" to="/forgot-password">Request a new reset link</Link>
                <Link className="login-register-link" to="/login">Return to login</Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
