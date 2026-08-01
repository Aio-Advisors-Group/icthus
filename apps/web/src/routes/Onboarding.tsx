import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LinkButton, Card, Muted, Notice } from '../components/ui';
import { SubPageHeader } from '../components/AppShell';

/**
 * Onboarding is a single screen you can skip. There is no denomination
 * question, no theological vocabulary test, and no account required to begin.
 */
export default function Onboarding(): ReactNode {
  return (
    <>
      <SubPageHeader backTo="/" backLabel="Today" title="What Icthus is" />

      <p className="ic-serif m-0 text-[18px] leading-relaxed">
        Icthus begins with your life, not with a Bible passage. You bring what is actually happening
        — a good day, a hard one, a question, a prayer — and Icthus helps you find a grounded place
        to begin.
      </p>

      <section aria-labelledby="how-heading" className="mt-8">
        <h2 id="how-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
          How it works
        </h2>
        <ol className="m-0 list-none space-y-4 p-0">
          {[
            {
              title: 'You bring something real',
              body: 'Write it, say it, or paste a note. You do not need the right words.',
            },
            {
              title: 'Scripture comes first',
              body: 'Icthus finds a passage and shows you its reference, translation, and where it came from.',
            },
            {
              title: 'AI helps you read, never decides for you',
              body: 'The reflection is written from retrieved sources and every claim is cited. It offers invitations, not instructions.',
            },
            {
              title: 'It stays yours',
              body: 'Private by default. Nothing leaves Icthus unless you set that up yourself.',
            },
          ].map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[12px] font-bold text-[var(--paper)]"
              >
                {index + 1}
              </span>
              <span>
                <span className="block text-[14px] font-semibold">{step.title}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-[var(--muted)]">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="welcome-heading" className="mt-8">
        <h2 id="welcome-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
          You are welcome here
        </h2>
        <Card tone="sand" className="p-4">
          <p className="m-0 text-[14px] leading-relaxed">
            Icthus will not ask your denomination, your church, or whether you would call yourself a
            Christian. Sources from a particular tradition are always labelled as such, and they are
            never a condition of being met where you are.
          </p>
        </Card>
      </section>

      <section aria-labelledby="limits-heading" className="mt-8">
        <h2 id="limits-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
          What it is not
        </h2>
        <Notice tone="warn">
          Icthus is not emergency support, medical or psychological care, confession, or a
          replacement for a local church or a real person. It does not speak for God, and it will
          not tell you what God wants you to do.
        </Notice>
      </section>

      <div className="mt-8">
        <LinkButton to="/" variant="primary" full>
          Begin
        </LinkButton>
      </div>
      <Muted className="mt-4">
        You can read this again any time from You. Read the full{' '}
        <Link to="/privacy" className="text-[var(--gold)] underline">
          privacy detail
        </Link>{' '}
        before signing in.
      </Muted>
    </>
  );
}
