// Verify a password setup link and let a new member choose their password.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import loginBg from '../../assets/Member login clean.png';
import apiClient from '../../lib/apiClient.js';
import useAuth from '../../context/useAuth.js';
import '../LoginPage/LoginPage.css';
import './Activate.css';

export default function Activate() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [account, setAccount] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    if (!token) {
      setError('This password link is missing or invalid. Request a new link below.');
      setLoading(false);
      return undefined;
    }

    apiClient.get(`/auth/activate/verify?token=${encodeURIComponent(token)}`)
      .then((result) => {
        if (active) {
          setAccount(result);
          setEmail(result.email);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function handleActivate(event) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Your password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiClient.post('/auth/activate', {
        token: token.trim(),
        password,
        confirmPassword,
      });
      if (result.awaitingApproval) {
        navigate('/login', {
          replace: true,
          state: { message: result.message || 'Your password is set. Your account will be available after membership approval.' },
        });
        return;
      }
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const result = await apiClient.post('/auth/forgot-password', { email });
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
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
              <h1 className="login-title">Set your password</h1>
              <p className="login-subtitle">
                {account
                  ? `Welcome, ${account.firstName}. Choose a password for your OrianaaClub account.`
                  : 'Use the secure link in your email to set your password.'}
              </p>
            </header>
            {loading && <p className="login-subtitle" role="status">Checking your password link...</p>}
            {account && !loading && (
              <p className="login-alert-success" role="status">Use at least 8 characters.</p>
            )}
            {error && <p className="auth-form-error" role="alert">{error}</p>}
            {message && <p className="login-alert-success" role="status">{message}</p>}
            {account && !loading && (
              <form className="login-form" onSubmit={handleActivate}>
                <div className="login-field">
                  <label className="login-label" htmlFor="activate-password">Password</label>
                  <div className="login-input-wrapper">
                    <input
                      className="login-input"
                      id="activate-password"
                      type="password"
                      autoComplete="new-password"
                      minLength="8"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                </div>
                <div className="login-field">
                  <label className="login-label" htmlFor="activate-confirm-password">Confirm password</label>
                  <div className="login-input-wrapper">
                    <input
                      className="login-input"
                      id="activate-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      minLength="8"
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </div>
                </div>
                <button className="login-submit-btn" type="submit" disabled={submitting || password.length < 8 || password !== confirmPassword}>{submitting ? 'Saving…' : 'Set password'}</button>
              </form>
            )}
            {!account && !loading && (
              <form className="login-form" onSubmit={handleResend}>
                <div className="login-field">
                  <label className="login-label" htmlFor="activate-email">Email address</label>
                  <div className="login-input-wrapper">
                    <input className="login-input" id="activate-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                  </div>
                </div>
                <button className="login-submit-btn" type="submit">Send me a new link</button>
              </form>
            )}
            <div className="login-footer-prompt"><Link className="login-register-link" to="/login">Return to login</Link></div>
          </div>
        </section>
      </div>
    </main>
  );
}
