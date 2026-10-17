// This page reads the one-time token from the emailed link and submits a new password.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import api, { errorMessage } from '../api/client.js';
import { Button, FormField, PasswordField, Toast } from '../components/ui.jsx';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/admin/auth/reset-password', { token, password, confirmPassword });
      setDone(true);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-midnight px-4 py-10">
    <section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="h-1.5 bg-gold" /><div className="p-7 sm:p-10">
      <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-gold">Account recovery</p>
      <h1 className="mb-2 font-display text-3xl text-midnight">Choose a new password</h1>
      <p className="mb-6 text-sm text-slate-500">Use at least 8 characters, including uppercase, lowercase, and a number.</p>
      {error && <Toast kind="error">{error}</Toast>}
      {done ? <><Toast>Your password has been reset. You can now sign in.</Toast><Link className="text-sm font-semibold text-forest hover:underline" to="/login">Return to sign in</Link></>
        : !token ? <><Toast kind="error">This password reset link is missing its token.</Toast><Link className="text-sm font-semibold text-forest hover:underline" to="/login">Request another reset link</Link></>
          : <form className="space-y-4" onSubmit={submit}>
            <FormField label="New password"><PasswordField value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></FormField>
            <FormField label="Confirm password"><span className="relative block"><input className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-11 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required /><LockKeyhole size={17} className="absolute right-3 top-3 text-slate-400" /></span></FormField>
            <Button className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Reset password'}</Button>
          </form>}
    </div></section>
  </main>;
}
