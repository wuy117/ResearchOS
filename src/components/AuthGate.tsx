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
    <main className="auth-gate grid min-h-screen place-items-center bg-ivory px-4 py-6 text-ink sm:px-6 sm:py-10">
      <section className="auth-panel w-full max-w-md py-4 sm:py-8">
        <div className="auth-brand flex items-center gap-3.5">
          <div className="auth-brand-mark grid size-10 place-items-center rounded-lg bg-paper" aria-hidden="true">
            <BookOpen size={22} />
          </div>
          <div>
            <p className="auth-brand-name text-sm font-semibold text-ink">Research OS</p>
            <p className="auth-brand-meta text-xs text-graphite/80">Private academic workspace</p>
          </div>
        </div>

        <div className="auth-intro mt-10 border-t border-ink/[0.065] pt-9 sm:mt-12">
          <h1 className="auth-title max-w-[12ch] text-balance font-serif text-4xl font-semibold leading-tight text-ink">{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="auth-copy mt-4 max-w-sm text-pretty text-sm leading-7 text-graphite/80">
            {mode === 'sign-in' ? 'Continue to your private academic workspace.' : 'Keep your sources, Tutor history, and progress together in one private workspace.'}
          </p>
        </div>

        <div className="auth-mode-switch mt-6 grid grid-cols-2 gap-2 rounded-lg bg-paper p-1">
          <button type="button" aria-pressed={mode === 'sign-in'} onClick={() => setMode('sign-in')} className={`auth-mode-option min-h-11 rounded-md px-4 py-2.5 text-sm font-semibold ${mode === 'sign-in' ? 'is-active bg-white text-ink shadow-sm' : 'text-graphite'}`}>
            Sign in
          </button>
          <button type="button" aria-pressed={mode === 'sign-up'} onClick={() => setMode('sign-up')} className={`auth-mode-option min-h-11 rounded-md px-4 py-2.5 text-sm font-semibold ${mode === 'sign-up' ? 'is-active bg-white text-ink shadow-sm' : 'text-graphite'}`}>
            Sign up
          </button>
        </div>

        <form className="auth-form mt-6 space-y-5" onSubmit={submit}>
          <label className="auth-field block">
            <span className="auth-field-label text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="auth-input mt-2 min-h-12 w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4"
            />
          </label>
          <label className="auth-field block">
            <span className="auth-field-label text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              className="auth-input mt-2 min-h-12 w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4"
            />
          </label>

          {message || authError ? (
            <p
              key={message || authError}
              role="status"
              className={`auth-status status-enter rounded-lg px-4 py-3 text-sm leading-6 ${message && messageTone === 'success' && !authError ? 'is-success bg-moss/10 text-moss' : 'is-error bg-red-50 text-red-700'}`}
            >
              {message || authError}
            </p>
          ) : null}

          <button type="submit" disabled={authLoading || isSubmitting} className="auth-submit inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-graphite disabled:bg-graphite/45">
            {mode === 'sign-in' ? <LogIn size={17} /> : <UserPlus size={17} />}
            {authLoading || isSubmitting ? 'Checking…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-assurance mt-8 flex max-w-sm items-start gap-2.5 text-xs leading-5 text-graphite/80">
          <LockKeyhole size={14} className="mt-0.5 shrink-0" />
          <p>Secure sign-in. Research OS never stores your password.</p>
        </div>
      </section>
    </main>
  );
}
