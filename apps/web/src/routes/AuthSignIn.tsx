import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/AppProvider';
import { sendMagicLink } from '../lib/supabase';
import { SubPageHeader } from '../components/AppShell';
import { Button, Card, Muted, Notice } from '../components/ui';

export default function AuthSignIn(): ReactNode {
  const { supabaseConfigured, session } = useApp();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setStatus('sending');
    const { error } = await sendMagicLink(email.trim());
    if (error) {
      setStatus('error');
      setMessage(error);
      return;
    }
    setStatus('sent');
    setMessage(null);
  }

  return (
    <>
      <SubPageHeader
        backTo="/you"
        backLabel="You"
        title="Sign in"
        lede="Icthus uses a single-use link sent to your email. There is no password to remember or lose."
      />

      {session ? (
        <Notice title="You are already signed in">
          Signed in as {session.user.email}. You can sign out from You.
        </Notice>
      ) : !supabaseConfigured ? (
        <Notice tone="warn" title="Sign-in is not configured in this build">
          No Supabase project is connected, so there is nothing to sign in to. Everything you write
          stays on this device and still works. See SUPABASE_SETUP.md to connect a backend.
        </Notice>
      ) : status === 'sent' ? (
        <Card className="p-4">
          <p className="m-0 text-[15px] leading-relaxed">
            Check your email. The link signs you in on this device and expires shortly.
          </p>
          <Muted className="mt-2">
            Sent to {email}. If it does not arrive, check spam or try again in a minute.
          </Muted>
        </Card>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="email" className="mb-2 block text-[13px] font-semibold">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="min-h-[48px] w-full rounded-[15px] border border-[var(--line)] bg-[var(--surface)] px-4 text-[15px] outline-none focus:border-[var(--gold)]"
          />

          {status === 'error' && message ? (
            <div className="mt-4">
              <Notice tone="warn">{message}</Notice>
            </div>
          ) : null}

          <div className="mt-5">
            <Button type="submit" full disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send me a link'}
            </Button>
          </div>
        </form>
      )}

      <Muted className="mt-6">
        Anything you have already written stays on this device until you sign in and choose to save
        it. Read what Icthus does with your data in{' '}
        <Link to="/privacy" className="text-[var(--gold)] underline">
          Privacy
        </Link>
        .
      </Muted>

      <Muted className="mt-4">
        Sign in with Apple is designed for but not yet shipped — it needs the native app wrapper.
      </Muted>
    </>
  );
}
