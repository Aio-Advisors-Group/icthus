import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/AppProvider';
import { LinkButton, Notice, Spinner } from '../components/ui';
import { SubPageHeader } from '../components/AppShell';

/**
 * The magic-link landing route.
 *
 * supabase-js consumes the token from the URL itself (detectSessionInUrl), so
 * this screen only has to wait for the session to appear and then get out of
 * the way.
 */
export default function AuthCallback(): ReactNode {
  const { session, authReady } = useApp();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true });
      return;
    }
    if (!authReady) return;
    const timer = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, [session, authReady, navigate]);

  if (timedOut) {
    return (
      <>
        <SubPageHeader backTo="/you" backLabel="You" title="Sign-in link" />
        <Notice tone="warn" title="That link did not sign you in">
          It may have already been used or expired. Links are single-use and short-lived on purpose.
        </Notice>
        <div className="mt-5">
          <LinkButton to="/auth/sign-in" variant="primary">
            Send a new link
          </LinkButton>
        </div>
      </>
    );
  }

  return <Spinner label="Signing you in" />;
}
