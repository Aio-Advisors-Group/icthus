import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatTimeLabel, nextCompanionRun } from '@icthus/core';
import { useApp } from '../lib/AppProvider';
import { useCompanionSettings, useMemoryPreferences, useRoutes } from '../lib/hooks';
import { Badge, Card, LinkButton, Muted, NavRow } from '../components/ui';
import { signOut } from '../lib/supabase';

export default function You(): ReactNode {
  const { session, supabaseConfigured, repository } = useApp();
  const memory = useMemoryPreferences();
  const routes = useRoutes();
  const companion = useCompanionSettings();

  const activeRoutes = (routes.data ?? []).filter((route) => route.enabled && !route.revokedAt);
  const nextRun = companion.data ? nextCompanionRun(companion.data) : null;

  return (
    <>
      <h1 className="ic-serif mt-7 mb-3 text-[30px] leading-tight font-normal">You</h1>
      <Muted className="mb-6">
        Everything Icthus knows about you lives here, and everything here can be turned off.
      </Muted>

      <Card className="mb-6 p-4">
        <p className="m-0 text-[14px] font-semibold">{session?.user?.email ?? 'Signed out'}</p>
        <Muted className="mt-1">
          {repository.mode === 'supabase'
            ? 'Your reflections are saved to your account.'
            : supabaseConfigured
              ? 'You are signed out. Reflections stay on this device until you sign in.'
              : 'No backend is configured in this build, so everything stays on this device.'}
        </Muted>
        <div className="mt-4">
          {session ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="min-h-[44px] text-[13px] font-bold text-[var(--gold)]"
            >
              Sign out
            </button>
          ) : (
            <LinkButton to="/auth/sign-in" variant="secondary">
              Sign in
            </LinkButton>
          )}
        </div>
      </Card>

      <nav aria-label="Settings">
        <NavRow
          to="/you/everywhere"
          glyph="◒"
          title="Icthus Everywhere"
          subtitle="Choose where your reflections and Scripture can appear"
          trailing={
            activeRoutes.length > 0 ? (
              <Badge tone="ok">{activeRoutes.length} active</Badge>
            ) : (
              <Badge tone="neutral">None yet</Badge>
            )
          }
        />
        <NavRow
          to="/you/daily-companion"
          glyph="✧"
          title="Daily Devotional Companion"
          subtitle="Meets you in what you've captured, guides you back to Christ"
          trailing={
            companion.data?.enabled && nextRun ? (
              <Badge tone="ok">{formatTimeLabel(nextRunTime(companion.data.schedule))}</Badge>
            ) : (
              <Badge tone="neutral">Off</Badge>
            )
          }
        />
        <NavRow
          to="/you/memory"
          glyph="✦"
          title="Memory"
          subtitle="Notice recurring themes across your own reflections"
          trailing={
            memory.data?.enabled ? <Badge tone="ok">On</Badge> : <Badge tone="neutral">Off</Badge>
          }
        />
        <NavRow
          to="/you/integrations"
          glyph="◈"
          title="Connections"
          subtitle="What is connected, what is running locally, and why"
        />
        <NavRow
          to="/privacy"
          glyph="◑"
          title="Privacy and your data"
          subtitle="Export everything, delete an entry, or delete your account"
        />
      </nav>

      <div className="mt-8">
        <Muted>
          Icthus is a companion for reflection. It is not emergency support, medical or
          psychological care, confession, or a substitute for a local church.{' '}
          <Link to="/onboarding" className="text-[var(--gold)] underline">
            What Icthus is and is not
          </Link>
        </Muted>
      </div>
    </>
  );
}

function nextRunTime(schedule: { frequency: string; time?: string }): string {
  return schedule.time ?? '07:30';
}
