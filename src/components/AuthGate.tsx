import { BookOpen, LockKeyhole, LogIn, UserPlus } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';

type AuthGateProps = {
  authLoading: boolean;
  authError: string;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
};

export function AuthGate({ authLoading, authError, onSignIn, onSignUp }: AuthGateProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('error');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail || password.length < 6) {
      setMessageTone('error');
      setMessage('Use an email address and a password of at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    try {
      if (mode === 'sign-in') {
        await onSignIn(nextEmail, password);
      } else {
        await onSignUp(nextEmail, password);
        setMessageTone('success');
        setMessage('Account created. If email confirmation is enabled, check your inbox before signing in.');
      }
    } catch {
      setMessageTone('error');
      setMessage(mode === 'sign-in' ? 'Sign-in failed. Check your email and password.' : 'Account could not be created. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ivory px-4 py-8 text-ink">
      <section className="w-full max-w-md py-4 sm:py-8">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-paper">
            <BookOpen size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Research OS</p>
            <p className="text-xs text-graphite/80">Private academic workspace</p>
          </div>
        </div>

        <div className="mt-10 border-t border-ink/[0.065] pt-9">
          <h1 className="font-serif text-4xl font-semibold leading-tight text-ink">{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-4 text-sm leading-7 text-graphite/80">
            {mode === 'sign-in' ? 'Continue to your private academic workspace.' : 'Keep your sources, Tutor history, and progress together in one private workspace.'}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg bg-paper p-1">
          <button type="button" aria-pressed={mode === 'sign-in'} onClick={() => setMode('sign-in')} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === 'sign-in' ? 'bg-white text-ink shadow-sm' : 'text-graphite'}`}>
            Sign in
          </button>
          <button type="button" aria-pressed={mode === 'sign-up'} onClick={() => setMode('sign-up')} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === 'sign-up' ? 'bg-white text-ink shadow-sm' : 'text-graphite'}`}>
            Sign up
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="mt-2 w-full rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm outline-none ring-ink/10 focus:ring-4"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              className="mt-2 w-full rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm outline-none ring-ink/10 focus:ring-4"
            />
          </label>

          {message || authError ? (
            <p
              key={message || authError}
              role="status"
              className={`status-enter rounded-lg px-3 py-2 text-sm leading-6 ${message && messageTone === 'success' && !authError ? 'bg-moss/10 text-moss' : 'bg-red-50 text-red-700'}`}
            >
              {message || authError}
            </p>
          ) : null}

          <button type="submit" disabled={authLoading || isSubmitting} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-graphite disabled:bg-graphite/45">
            {mode === 'sign-in' ? <LogIn size={17} /> : <UserPlus size={17} />}
            {authLoading || isSubmitting ? 'Checking…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-7 flex items-center gap-2 text-xs leading-5 text-graphite/80">
          <LockKeyhole size={14} className="shrink-0" />
          <p>Secure sign-in. Research OS never stores your password.</p>
        </div>
      </section>
    </main>
  );
}
