import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SCRIPTURE_CORPUS, themeLabel, toReferenceSlug } from '@icthus/core';
import { Card, EmptyState, Eyebrow, Muted } from '../components/ui';

/**
 * Explore is theme-led rather than book-led: the first screen of Icthus should
 * never ask someone to already know where to look.
 */

const FEATURED_THEMES = [
  'anxiety',
  'grief',
  'gratitude',
  'forgiveness',
  'purpose',
  'loneliness',
  'discernment',
  'hope',
] as const;

export default function Explore(): ReactNode {
  const [query, setQuery] = useState('');

  const passagesByTheme = useMemo(() => {
    return FEATURED_THEMES.map((theme) => ({
      theme,
      passages: SCRIPTURE_CORPUS.filter((passage) => passage.themes.includes(theme)),
    })).filter((section) => section.passages.length > 0);
  }, []);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return null;
    return SCRIPTURE_CORPUS.filter(
      (passage) =>
        passage.reference.toLowerCase().includes(needle) ||
        passage.text.toLowerCase().includes(needle) ||
        passage.themes.some((theme) => theme.includes(needle)),
    );
  }, [query]);

  return (
    <>
      <h1 className="ic-serif mt-7 mb-3 text-[30px] leading-tight font-normal">Explore</h1>
      <Muted className="mb-5">
        Start from what you are carrying rather than from a book and chapter.
      </Muted>

      <label htmlFor="explore-search" className="sr-only">
        Search passages and themes
      </label>
      <input
        id="explore-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search a word, a feeling, or a reference"
        className="min-h-[48px] w-full rounded-[15px] border border-[var(--line)] bg-[var(--surface)] px-4 text-[14px] outline-none focus:border-[var(--gold)]"
      />

      {results ? (
        <section aria-label="Search results" className="mt-6">
          <Eyebrow>
            {results.length} {results.length === 1 ? 'passage' : 'passages'}
          </Eyebrow>
          {results.length === 0 ? (
            <EmptyState
              title="Nothing matched that"
              body="Try a feeling rather than a phrase — “tired”, “afraid”, “thankful”."
            />
          ) : (
            <ul className="m-0 list-none space-y-3 p-0">
              {results.map((passage) => (
                <li key={passage.sourceId}>
                  <PassageLink
                    slug={toReferenceSlug(passage.canonical)}
                    reference={passage.reference}
                    text={passage.text}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <div className="mt-7 space-y-8">
          {passagesByTheme.map((section) => (
            <section key={section.theme} aria-labelledby={`theme-${section.theme}`}>
              <h2
                id={`theme-${section.theme}`}
                className="ic-serif m-0 mb-3 text-[20px] font-normal"
              >
                {themeLabel(section.theme)}
              </h2>
              <ul className="m-0 list-none space-y-3 p-0">
                {section.passages.map((passage) => (
                  <li key={passage.sourceId}>
                    <PassageLink
                      slug={toReferenceSlug(passage.canonical)}
                      reference={passage.reference}
                      text={passage.text}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Muted className="mt-8">
        Passages here come from the World English Bible, which is in the public domain. When a
        licensed translation is connected, this list follows your choice in You.
      </Muted>
    </>
  );
}

function PassageLink({
  slug,
  reference,
  text,
}: {
  slug: string;
  reference: string;
  text: string;
}): ReactNode {
  return (
    <Link to={`/study/${slug}`} className="block no-underline">
      <Card className="p-4">
        <p className="m-0 text-[11px] font-extrabold tracking-[0.1em] text-[var(--gold)] uppercase">
          {reference}
        </p>
        <p className="ic-serif mt-2 mb-0 line-clamp-3 text-[16px] leading-relaxed text-[var(--ink)]">
          {text}
        </p>
      </Card>
    </Link>
  );
}
