import { useEffect, useRef, useState } from 'react';
import classes from './MarkGrid.module.css';
import { formatTenths, isCompleteMark, MARK_CHARS, parseMark } from './parseMark';

export type NavIntent = 'next' | 'prev' | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

interface Props {
  value: number | undefined;
  readOnly: boolean;
  autoAdvance: boolean;
  /** "none" keeps the system keyboard away when an on-screen number pad is in use. */
  inputMode: 'decimal' | 'none';
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
  inputMode,
  label,
  inputRef,
  onCommit,
  onNavigate,
  onFocus,
}: Props) {
  // draft: text being typed (null = show stored value)
  const [draft, setDraftState] = useState<string | null>(null);
  // committed value awaiting the database round trip, so the old value doesn't flash back
  const [pending, setPending] = useState<{ tenths: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mirrors of draft/shown that update synchronously. Committing moves focus to the next cell,
  // which fires this cell's blur handler *before* React re-renders; reading state there would
  // see the stale draft (e.g. "5" of "57") and commit it over the value just saved.
  const draftRef = useRef<string | null>(null);
  const shownRef = useRef<number | null | undefined>(value);
  const setDraft = (v: string | null) => {
    draftRef.current = v;
    setDraftState(v);
  };

  useEffect(() => {
    setPending(null);
    shownRef.current = value;
  }, [value]);

  const shown = pending ? pending.tenths : value;
  const display = draft ?? formatTenths(shown);

  /** Commits the current draft, if any. Returns false (and shows an error) if it isn't a valid mark. */
  const commit = (): boolean => {
    const raw = draftRef.current;
    if (raw === null) return true;
    const r = parseMark(raw);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    setDraft(null);
    setError(null);
    if (r.tenths !== (shownRef.current ?? null)) {
      shownRef.current = r.tenths;
      setPending({ tenths: r.tenths });
      onCommit(r.tenths);
    }
    return true;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (commit()) onNavigate(e.shiftKey ? 'prev' : 'next');
    } else if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight'
    ) {
      e.preventDefault();
      if (commit()) onNavigate(e.key);
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
    if (autoAdvance && isCompleteMark(v) && commit()) onNavigate('next');
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
      inputMode={inputMode}
      autoComplete="off"
      spellCheck={false}
      aria-label={label}
      aria-invalid={!!error}
      title={error ?? undefined}
      onFocus={(e) => {
        e.currentTarget.select();
        onFocus();
      }}
      // Clicking a cell would place the caret where clicked (undoing the select-all), so the next
      // digits get appended to the old value. Select the whole value instead — unless the user is
      // mid-edit, when a click should position the caret as usual.
      onMouseDown={(e) => {
        if (draftRef.current !== null) return;
        e.preventDefault();
        e.currentTarget.focus();
        e.currentTarget.select();
      }}
      onBlur={() => commit()}
      onKeyDown={onKeyDown}
      onChange={readOnly ? undefined : onChange}
    />
  );
}
