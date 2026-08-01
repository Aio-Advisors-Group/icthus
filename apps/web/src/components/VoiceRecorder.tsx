import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AUDIO_RETENTION_LABELS,
  DEFAULT_AUDIO_RETENTION,
  type AudioRetentionPolicy,
} from '@icthus/core';
import { useApp } from '../lib/AppProvider';
import { Button, Card, Muted, Notice } from './ui';

/**
 * Voice capture.
 *
 * The recording stays in this browser. Nothing is uploaded here, and no
 * transcript is invented: with no transcription provider configured the person
 * writes what they said, in the same editable field a machine transcript would
 * land in.
 */
export function VoiceRecorder(): ReactNode {
  const { transcription } = useApp();
  const [state, setState] = useState<'idle' | 'recording' | 'recorded' | 'denied' | 'unsupported'>(
    'idle',
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [retention, setRetention] = useState<AudioRetentionPolicy>(DEFAULT_AUDIO_RETENTION);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function start(): Promise<void> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof MediaRecorder === 'undefined'
    ) {
      setState('unsupported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        setState('recorded');
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000);
      setState('recording');
    } catch {
      setState('denied');
    }
  }

  function stop(): void {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }

  function discard(): void {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setSeconds(0);
    setState('idle');
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-[14px] font-semibold">Record a reflection</p>
          <Muted className="mt-1">
            {state === 'recording'
              ? `Recording — ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
              : 'Stays on this device until you choose otherwise.'}
          </Muted>
        </div>
        {state === 'recording' ? (
          <Button variant="danger" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button variant="secondary" onClick={start} disabled={state === 'unsupported'}>
            {state === 'recorded' ? 'Record again' : 'Record'}
          </Button>
        )}
      </div>

      {audioUrl ? (
        <div className="mt-4">
          {/* No <track> element: this is the person's own recording played back
              to themselves, and the editable transcript below is its text
              equivalent. */}
          <audio src={audioUrl} controls className="w-full" aria-label="Your recording" />
          <div className="mt-3 flex gap-2">
            <Button variant="quiet" onClick={discard} className="px-3 text-[12px]">
              Delete recording
            </Button>
          </div>
        </div>
      ) : null}

      {state === 'denied' ? (
        <div className="mt-4">
          <Notice tone="warn">
            Microphone access was declined, so recording is unavailable. You can still type what you
            wanted to say in the field below.
          </Notice>
        </div>
      ) : null}

      {state === 'unsupported' ? (
        <div className="mt-4">
          <Notice tone="warn">
            This browser does not support in-page recording. You can still type your reflection
            below.
          </Notice>
        </div>
      ) : null}

      <div className="mt-4">
        <Notice
          title={
            transcription.state === 'live'
              ? 'Your transcript will appear below for review'
              : 'Transcription is not configured in this build'
          }
        >
          {transcription.state === 'live'
            ? 'You can correct anything before it becomes an entry.'
            : 'Icthus will not invent words you did not say. Type or correct your reflection in the field below — it works exactly the same way from there.'}
        </Notice>
      </div>

      <fieldset className="m-0 mt-4 border-0 p-0">
        <legend className="mb-2 text-[12px] font-semibold">What should happen to the audio?</legend>
        {(Object.keys(AUDIO_RETENTION_LABELS) as AudioRetentionPolicy[]).map((policy) => (
          <label key={policy} className="flex min-h-[44px] items-center gap-3 text-[13px]">
            <input
              type="radio"
              name="audio-retention"
              value={policy}
              checked={retention === policy}
              onChange={() => setRetention(policy)}
            />
            {AUDIO_RETENTION_LABELS[policy]}
          </label>
        ))}
      </fieldset>
    </Card>
  );
}
