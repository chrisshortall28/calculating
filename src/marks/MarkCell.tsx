import { useEffect, useState } from 'react';
import classes from './MarkGrid.module.css';
import { formatTenths, isCompleteMark, MARK_CHARS, parseMark } from './parseMark';

export type NavIntent = 'next' | 'prev' | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

interface Props {
  value: number | undefined;
  readOnly: boolean;
  autoAdvance: boolean;
  label: string;
  inputRef: (el: HTMLInputElement | null) => void;
  onCommit: (tenths: number | null) => void;
  onNavigate: (intent: NavIntent) => void;
  onFocus: () => void;
}

export function MarkCell({
  value,
  readOnly,
  autoAdvance,
  label,
  inputRef,
  onCommit,
  onNavigate,
  onFocus,
}: Props) {
  // draft: text being typed (null = show stored value)
  const [draft, setDraft] = useState<string | null>(null);
  // committed value awaiting the database round trip, so the old value doesn't flash back
  const [pending, setPending] = useState<{ tenths: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPending(null), [value]);

  const shown = pending ? pending.tenths : value;
  const display = draft ?? formatTenths(shown);

  /** Returns false (and shows an error) if the draft isn't a valid mark. */
  const commit = (raw: string | null): boolean => {
    if (raw === null) return true;
    const r = parseMark(raw);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    setDraft(null);
    setError(null);
    if (r.tenths !== (shown ?? null)) {
      setPending({ tenths: r.tenths });
      onCommit(r.tenths);
    }
    return true;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (commit(draft)) onNavigate(e.shiftKey ? 'prev' : 'next');
    } else if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight'
    ) {
      e.preventDefault();
      if (commit(draft)) onNavigate(e.key);
    } else if (e.key === 'Escape') {
      const input = e.currentTarget;
      setDraft(null);
      setError(null);
      // Re-select so the next keystroke replaces the restored value rather than appending.
      requestAnimationFrame(() => input.select());
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.currentTarget.value;
    if (!MARK_CHARS.test(v)) return;
    setDraft(v);
    setError(null);
    if (autoAdvance && isCompleteMark(v) && commit(v)) onNavigate('next');
  };

  const className = [
    classes.cell,
    shown === undefined || shown === null ? classes.empty : '',
    error ? classes.error : '',
  ].join(' ');

  return (
    <input
      ref={inputRef}
      className={className}
      value={display}
      readOnly={readOnly}
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      aria-label={label}
      aria-invalid={!!error}
      title={error ?? undefined}
      onFocus={(e) => {
        e.currentTarget.select();
        onFocus();
      }}
      onBlur={() => commit(draft)}
      onKeyDown={onKeyDown}
      onChange={readOnly ? undefined : onChange}
    />
  );
}
