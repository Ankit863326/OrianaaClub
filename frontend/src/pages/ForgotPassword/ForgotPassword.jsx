// Phase 1: Request a password reset without revealing whether an account exists.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import loginBg from '../../assets/Member login clean.png';
import apiClient from '../../lib/apiClient.js';
import '../LoginPage/LoginPage.css';
import './ForgotPassword.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const result = await apiClient.post('/auth/forgot-password', { email });
      setMessage(result.message);
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
              <h1 className="login-title">Forgot Password</h1>
              <p className="login-subtitle">We’ll send a reset link if your account is eligible.</p>
            </header>
            {message && <p className="login-alert-success" role="status">{message}</p>}
            {error && <p className="auth-form-error" role="alert">{error}</p>}
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="login-field">
                <label className="login-label" htmlFor="forgot-email">Email</label>
                <div className="login-input-wrapper">
                  <input className="login-input" id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
              </div>
              <button className="login-submit-btn" type="submit" disabled={submitting}>{submitting ? 'Sending...' : 'Send Reset Link'}</button>
            </form>
            <div className="login-footer-prompt"><Link className="login-register-link" to="/login">Return to login</Link></div>
          </div>
        </section>
      </div>
    </main>
  );
}
