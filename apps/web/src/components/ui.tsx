import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * The shared UI kit.
 *
 * Small on purpose. Every interactive element here meets the 44px minimum
 * touch target and carries a visible focus ring from the token layer.
 */

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--ink)] text-[var(--paper)] border-transparent',
  secondary: 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)]',
  quiet: 'bg-transparent text-[var(--gold)] border-transparent',
  danger: 'bg-[var(--sand)] text-[var(--clay)] border-transparent',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  full?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', full = false, className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={[
        'min-h-[44px] rounded-2xl border px-5 text-[14px] font-semibold',
        'transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        BUTTON_STYLES[variant],
        full ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    />
  );
});

export function LinkButton({
  to,
  children,
  variant = 'secondary',
  full = false,
}: {
  to: string;
  children: ReactNode;
  variant?: ButtonVariant;
  full?: boolean;
}): ReactNode {
  return (
    <Link
      to={to}
      className={[
        'inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-5',
        'text-[14px] font-semibold transition-colors duration-150',
        BUTTON_STYLES[variant],
        full ? 'w-full' : '',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}

export function Card({
  children,
  className = '',
  tone = 'surface',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'surface' | 'sand' | 'rose';
}): ReactNode {
  const tones = {
    surface: 'bg-[var(--surface)] border border-[var(--line)]',
    sand: 'bg-[var(--sand)] border border-transparent',
    rose: 'bg-[var(--rose)] border border-transparent',
  };
  return <div className={`rounded-[20px] ${tones[tone]} ${className}`}>{children}</div>;
}

export function SectionHeading({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="mt-7 mb-3 flex items-center justify-between gap-3">
      <h2 className="ic-serif m-0 text-[21px] font-normal">{children}</h2>
      {action}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }): ReactNode {
  return (
    <p className="mt-0 mb-2 text-[11px] font-extrabold tracking-[0.12em] text-[var(--gold)] uppercase">
      {children}
    </p>
  );
}

export function Muted({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[13px] leading-relaxed text-[var(--muted)] ${className}`}>{children}</p>
  );
}

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  describedBy?: string;
  disabled?: boolean;
};

/**
 * A real switch: a button with role="switch" and aria-checked, so screen
 * readers and keyboards get the same affordance the visual gives everyone else.
 */
export function Switch({
  checked,
  onChange,
  label,
  describedBy,
  disabled = false,
}: SwitchProps): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative h-[30px] w-[52px] shrink-0 rounded-full border-2 border-transparent',
        'transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
        checked ? 'bg-[var(--ink)]' : 'bg-[var(--line)]',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'absolute top-[3px] block h-[20px] w-[20px] rounded-full bg-[var(--surface)]',
          'shadow-sm transition-transform duration-150',
          checked ? 'translate-x-[25px]' : 'translate-x-[3px]',
        ].join(' ')}
      />
    </button>
  );
}

export type BadgeTone = 'ok' | 'neutral' | 'warn' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  ok: 'bg-[color-mix(in_srgb,var(--moss)_16%,transparent)] text-[var(--moss)]',
  neutral: 'bg-[var(--sand)] text-[var(--muted)]',
  warn: 'bg-[color-mix(in_srgb,var(--clay)_14%,transparent)] text-[var(--clay)]',
  info: 'bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-[var(--gold)]',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full px-[10px] py-[5px] text-[11px] font-bold ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** A settings row that navigates. Rendered as a link so it behaves like one. */
export function NavRow({
  to,
  glyph,
  title,
  subtitle,
  trailing,
}: {
  to: string;
  glyph: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}): ReactNode {
  return (
    <Link
      to={to}
      className="flex min-h-[60px] w-full items-center gap-3 border-b border-[var(--line)] py-3 text-left last:border-b-0"
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--sand)] text-[16px]"
      >
        {glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold">{title}</span>
        {subtitle ? (
          <span className="mt-[2px] block text-[12px] text-[var(--muted)]">{subtitle}</span>
        ) : null}
      </span>
      {trailing ?? (
        <span aria-hidden="true" className="text-[16px] text-[var(--muted)]">
          ›
        </span>
      )}
    </Link>
  );
}

/** The non-navigating sibling of NavRow, for rows that toggle or act. */
export function InfoRow({
  glyph,
  title,
  subtitle,
  trailing,
}: {
  glyph: string;
  title: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}): ReactNode {
  return (
    <div className="flex min-h-[60px] w-full items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--sand)] text-[16px]"
      >
        {glyph}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[14.5px] font-semibold">{title}</p>
        {subtitle ? (
          <div className="mt-[2px] text-[12px] leading-snug text-[var(--muted)]">{subtitle}</div>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}

export function EmptyState({
  glyph = '◌',
  title,
  body,
  action,
}: {
  glyph?: string;
  title: string;
  body: string;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="px-3 py-10 text-center">
      <p aria-hidden="true" className="mb-3 text-[30px] text-[var(--gold)]">
        {glyph}
      </p>
      <p className="ic-serif m-0 mb-2 text-[17px] text-[var(--ink)]">{title}</p>
      <p className="mx-auto max-w-[34ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
        {body}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/**
 * A plain-language notice. Used wherever Icthus has to say what it cannot do —
 * these appear often by design.
 */
export function Notice({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: 'neutral' | 'warn';
  title?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div
      className={[
        'rounded-[14px] px-4 py-3 text-[12.5px] leading-relaxed',
        tone === 'warn'
          ? 'bg-[color-mix(in_srgb,var(--clay)_10%,transparent)] text-[var(--ink)]'
          : 'bg-[var(--sand)] text-[var(--muted)]',
      ].join(' ')}
    >
      {title ? <p className="m-0 mb-1 font-bold text-[var(--ink)]">{title}</p> : null}
      {children}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }): ReactNode {
  return (
    <p role="status" className="py-8 text-center text-[13px] text-[var(--muted)]">
      {label}…
    </p>
  );
}
