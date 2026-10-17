// This sign-in page supports admin login and password-reset email requests in tabs.
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, KeyRound, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import api, { errorMessage } from '../api/client.js';
import { Button, FormField, PasswordField, Toast, controlClass } from '../components/ui.jsx';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  if (!loading && user) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (tab === 'login') {
        await login({ email, password });
        window.location.assign('/');
      } else {
        const response = await api.post('/admin/auth/forgot-password', { email });
        setNotice(response.data.message);
      }
    } catch (failure) {
      setError(errorMessage(failure, 'Unable to sign in. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-midnight px-4 py-10">
    <section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="h-1.5 bg-gold" />
      <div className="p-7 sm:p-10">
        <div className="mb-7 text-center"><span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-midnight font-display text-xl font-bold text-gold">OC</span>
          <h1 className="font-display text-3xl text-midnight">OrianaaClub</h1><p className="mt-1 text-sm text-slate-500">Administrator access</p>
        </div>
        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Sign in or reset password">
          <button className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'login' ? 'bg-white text-forest shadow-sm' : 'text-slate-500'}`} onClick={() => { setTab('login'); setError(''); setNotice(''); }}>Sign in</button>
          <button className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'forgot' ? 'bg-white text-forest shadow-sm' : 'text-slate-500'}`} onClick={() => { setTab('forgot'); setError(''); setNotice(''); }}>Forgot password?</button>
        </div>
        {error && <Toast kind="error">{error}</Toast>}
        {notice && <Toast>{notice}</Toast>}
        <form className="space-y-4" onSubmit={submit}>
          <FormField label="Administrator email"><span className="relative"><Mail size={17} className="absolute left-3 top-3 text-slate-400" /><input className={`${controlClass} pl-10`} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></span></FormField>
          {tab === 'login' && <FormField label="Password"><PasswordField value={password} onChange={(event) => setPassword(event.target.value)} /></FormField>}
          <Button className="w-full py-3" disabled={busy}>{tab === 'login' ? <><LockKeyhole size={17} />{busy ? 'Signing in…' : 'Sign in securely'}</> : <><KeyRound size={17} />{busy ? 'Sending…' : 'Send reset link'}</>}</Button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">Access is limited to authorized OrianaaClub administrators.</p>
        {tab === 'forgot' && <Link className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-forest hover:underline" to="/login">Back to sign in <ArrowRight size={14} /></Link>}
      </div>
    </section>
  </main>;
}
