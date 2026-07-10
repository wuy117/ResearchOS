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
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail || password.length < 6) {
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
        setMessage('Account created. If email confirmation is enabled, check your inbox before signing in.');
      }
    } catch {
      setMessage(mode === 'sign-in' ? 'Sign-in failed. Check your email and password.' : 'Account could not be created. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ivory px-4 py-8 text-ink">
      <section className="w-full max-w-md rounded-lg border border-ink/8 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg border border-ink/8 bg-paper">
            <BookOpen size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Research OS</p>
            <p className="text-xs text-graphite/65">Private academic workspace</p>
          </div>
        </div>

        <div className="mt-8">
          <h1 className="font-serif text-3xl font-semibold leading-tight text-ink">Continue to Research OS</h1>
          <p className="mt-4 text-sm leading-7 text-graphite/72">
            Your documents, study history, Tutor memory, and progress records stay with your account.
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
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="mt-2 w-full rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm outline-none ring-ink/10 focus:ring-4"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              className="mt-2 w-full rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm outline-none ring-ink/10 focus:ring-4"
            />
          </label>

          {message || authError ? (
            <p key={message || authError} role="status" className="status-enter rounded-lg border border-brass/25 bg-brass/10 px-3 py-2 text-sm leading-6 text-graphite/78">{message || authError}</p>
          ) : null}

          <button type="submit" disabled={authLoading || isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white disabled:bg-graphite/45">
            {mode === 'sign-in' ? <LogIn size={17} /> : <UserPlus size={17} />}
            {authLoading || isSubmitting ? 'Checking...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 flex gap-3 rounded-lg border border-ink/8 bg-paper/70 p-3 text-sm leading-6 text-graphite/72">
          <LockKeyhole size={17} className="mt-0.5 shrink-0 text-graphite/60" />
          <p>Sign-in is handled securely. Research OS never stores your password.</p>
        </div>
      </section>
    </main>
  );
}
