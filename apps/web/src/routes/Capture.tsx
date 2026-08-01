import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PURPOSE_LABELS, classifySafety, type CaptureMode, type Purpose } from '@icthus/core';
import { useApp } from '../lib/AppProvider';
import { clearDraft, loadDraft, saveDraft } from '../lib/localRepository';
import { useMutateRepository } from '../lib/hooks';
import { Button, Card, Muted, Notice } from '../components/ui';
import { useToast } from '../components/Toast';
import { newId } from '../lib/id';
import { VoiceRecorder } from '../components/VoiceRecorder';

const MODES: { id: CaptureMode; label: string; glyph: string; placeholder: string }[] = [
  {
    id: 'write',
    label: 'Write',
    glyph: '✎',
    placeholder: 'You can start anywhere. What happened? What do you need? What are you carrying?',
  },
  {
    id: 'speak',
    label: 'Speak',
    glyph: '◉',
    placeholder:
      'Record below, then type or correct what you said. You review it before anything is saved.',
  },
  {
    id: 'note',
    label: 'Note',
    glyph: '↗',
    placeholder:
      'Paste a note here — from Apple Notes or anywhere else. You will see it before it is saved.',
  },
];

const PURPOSES: Purpose[] = ['pray', 'understand', 'discern', 'reflect'];

export default function Capture(): ReactNode {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { companion, session, supabaseConfigured } = useApp();
  const { notify } = useToast();

  const [mode, setMode] = useState<CaptureMode>('write');
  const [purpose, setPurpose] = useState<Purpose>('reflect');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createEntry = useMutateRepository(
    async (repository, args: { body: string; mode: CaptureMode; purpose: Purpose }) => {
      const entryId = newId();
      const now = new Date().toISOString();
      const response = await companion.respond({
        entryId,
        body: args.body,
        purpose: args.purpose,
      });
      await repository.createEntry(
        {
          id: entryId,
          kind:
            args.mode === 'note' ? 'imported_note' : args.mode === 'speak' ? 'voice' : 'reflection',
          mode: args.mode,
          purpose: args.purpose,
          body: args.body,
          occurredAt: now,
          createdAt: now,
          sourceKind:
            args.mode === 'note' ? 'imported_note' : args.mode === 'speak' ? 'voice' : 'typed',
          importedFrom: args.mode === 'note' ? 'pasted' : null,
          excludedFromMemory: false,
        },
        response,
      );
      return entryId;
    },
  );

  // Restore an unfinished draft, then keep it current as the person writes.
  useEffect(() => {
    let active = true;
    const prompt = params.get('prompt');
    loadDraft().then((draft) => {
      if (!active) return;
      if (prompt) {
        setBody(`${prompt}. `);
        textareaRef.current?.focus();
        return;
      }
      if (draft && draft.body.trim().length > 0) {
        setBody(draft.body);
        setMode(draft.mode);
        setPurpose(draft.purpose);
        setDraftRestored(true);
      }
    });
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    if (body.trim().length === 0) return;
    const timer = setTimeout(() => {
      void saveDraft({ body, mode, purpose });
    }, 400);
    return () => clearTimeout(timer);
  }, [body, mode, purpose]);

  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[0]!;
  const safety = body.trim().length > 0 ? classifySafety(body) : null;

  async function handleSubmit(): Promise<void> {
    if (body.trim().length === 0) {
      setError('Write something first — even one sentence is enough.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const entryId = await createEntry.mutateAsync({ body, mode, purpose });
      await clearDraft();
      setBody('');
      navigate(`/entry/${entryId}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Something went wrong: ${cause.message}. Your draft is still saved on this device.`
          : 'Something went wrong. Your draft is still saved on this device.',
      );
      notify('Your draft is safe');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="ic-serif mt-7 mb-4 text-[30px] leading-tight font-normal">
        Bring what is real.
      </h1>

      <fieldset className="m-0 border-0 p-0">
        <legend className="sr-only">How would you like to bring it?</legend>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((option) => {
            const selected = option.id === mode;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setMode(option.id)}
                className={[
                  'min-h-[48px] rounded-[13px] border px-2 text-[12.5px] font-medium',
                  selected
                    ? 'border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] text-[var(--gold)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]',
                ].join(' ')}
              >
                <span aria-hidden="true">{option.glyph}</span> {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {mode === 'speak' ? (
        <div className="mt-4">
          <VoiceRecorder />
        </div>
      ) : null}

      {mode === 'note' ? (
        <div className="mt-4">
          <Notice title="How importing works">
            Paste your note below. Icthus cannot read your notes, sync with Apple Notes, or see
            anything you do not paste here yourself.
          </Notice>
        </div>
      ) : null}

      <label htmlFor="capture-body" className="sr-only">
        {mode === 'speak' ? 'Transcript of what you said' : 'What is happening in your life today?'}
      </label>
      <textarea
        id="capture-body"
        ref={textareaRef}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={activeMode.placeholder}
        rows={7}
        className="mt-4 w-full resize-none rounded-[17px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[15px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--gold)]"
      />

      {draftRestored ? (
        <Muted className="mt-2">Restored from an unfinished draft on this device.</Muted>
      ) : null}

      <fieldset className="m-0 mt-6 border-0 p-0">
        <legend className="mb-2 text-[11px] font-extrabold tracking-[0.11em] text-[var(--gold)] uppercase">
          What would help most?
        </legend>
        <div className="flex flex-wrap gap-2">
          {PURPOSES.map((option) => {
            const selected = option === purpose;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => setPurpose(option)}
                className={[
                  'min-h-[44px] rounded-full border px-4 text-[13px] font-medium',
                  selected
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                    : 'border-[var(--line)] bg-transparent text-[var(--ink)]',
                ].join(' ')}
              >
                {PURPOSE_LABELS[option]}
              </button>
            );
          })}
        </div>
        <Muted className="mt-2">Optional. You never have to pick a category to be heard.</Muted>
      </fieldset>

      {safety?.state === 'urgent_support' ? (
        <div className="mt-5">
          <Notice tone="warn" title="Before you go on">
            What you have written sounds serious. When you submit this, Icthus will show support
            options rather than a devotional reflection. If you are in danger right now, please
            contact your local emergency number.
          </Notice>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5">
          <Notice tone="warn">{error}</Notice>
        </div>
      ) : null}

      <div className="mt-6">
        <Button full onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Finding a place to begin…' : 'Find a place to begin'}
        </Button>
      </div>

      <Card tone="sand" className="mt-4 p-4">
        <p className="m-0 text-[12px] leading-relaxed text-[var(--muted)]">
          Private by default. Icthus will not send this to a church, a person, or an integration
          without your permission.
          {supabaseConfigured
            ? session
              ? ' This will be saved to your account.'
              : ' You are signed out, so this stays on this device until you sign in and choose to save it.'
            : ' This build has no backend configured, so everything stays on this device.'}
        </p>
      </Card>
    </>
  );
}
