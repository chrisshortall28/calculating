import { Autocomplete, Button, Group, TagsInput, TextInput } from '@mantine/core';
import { useRef, useState } from 'react';
import { addSkater } from '../../db/repo';
import { skatersPerEntry } from '../../domain/entryName';
import type { Entry, EntryType, Id, Skater } from '../../domain/types';

export interface EntryDraft {
  names: string[]; // skater names (1 for solo/single, 2 for duo/pairs, any for team)
  club: string;
  teamName: string;
}

export const emptyDraft = (type: EntryType): EntryDraft => ({
  names: Array<string>(skatersPerEntry(type) ?? 0).fill(''),
  club: '',
  teamName: '',
});

export function draftFromEntry(entry: Entry, type: EntryType, skaters: Map<Id, Skater>): EntryDraft {
  const names = entry.skaterIds.map((id) => skaters.get(id)?.name ?? '');
  const base = emptyDraft(type);
  return {
    names: type === 'team' ? names : base.names.map((_, i) => names[i] ?? ''),
    club: entry.club ?? skaters.get(entry.skaterIds[0] ?? '')?.club ?? '',
    teamName: entry.teamName ?? '',
  };
}

/** Finds a skater by name (preferring the same club), creating one if needed. */
async function resolveSkater(competitionId: Id, name: string, club: string, skaters: Skater[]) {
  const matches = skaters.filter((s) => s.name.toLowerCase() === name.toLowerCase());
  const match = matches.find((s) => s.club.toLowerCase() === club.toLowerCase()) ?? matches[0];
  return match ? match.id : addSkater(competitionId, { name, club });
}

export async function draftToEntry(
  competitionId: Id,
  type: EntryType,
  draft: EntryDraft,
  skaters: Skater[],
): Promise<Pick<Entry, 'skaterIds' | 'teamName' | 'club'>> {
  const names = draft.names.map((n) => n.trim()).filter(Boolean);
  const skaterIds: Id[] = [];
  for (const name of names)
    skaterIds.push(await resolveSkater(competitionId, name, draft.club.trim(), skaters));
  return {
    skaterIds,
    teamName: type === 'team' ? draft.teamName.trim() : undefined,
    club: type === 'team' ? draft.club.trim() || undefined : undefined,
  };
}

export function validateDraft(type: EntryType, d: EntryDraft): string | null {
  if (type === 'team') return d.teamName.trim() ? null : 'Team name is required';
  if (d.names.some((n) => !n.trim()))
    return skatersPerEntry(type) === 2 ? 'Both skaters are required' : 'Skater name is required';
  return null;
}

/** Compact entry form tuned for rapid keyboard entry: Enter submits and focus returns to the first field. */
export function EntryForm({
  type,
  skaters,
  initial,
  submitLabel,
  onSubmit,
  inline,
}: {
  type: EntryType;
  skaters: Skater[];
  initial?: EntryDraft;
  submitLabel: string;
  onSubmit: (d: EntryDraft) => Promise<unknown>;
  inline?: boolean;
}) {
  const [draft, setDraft] = useState<EntryDraft>(initial ?? emptyDraft(type));
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  // `initial` is only read on mount (remount with a key to reset); a type change resets the form.
  const [lastType, setLastType] = useState(type);
  if (type !== lastType) {
    setLastType(type);
    setDraft(emptyDraft(type));
  }

  const names = [...new Set(skaters.map((s) => s.name))];
  const clubs = [...new Set(skaters.map((s) => s.club).filter(Boolean))];

  const setName = (i: number, v: string) => {
    const next = [...draft.names];
    next[i] = v;
    const known = skaters.find((s) => s.name === v);
    setDraft({ ...draft, names: next, club: i === 0 && known && !draft.club ? known.club : draft.club });
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateDraft(type, draft);
    if (err) return setError(err);
    await onSubmit(draft);
    if (inline) {
      setDraft({ ...emptyDraft(type), club: '' });
      firstRef.current?.focus();
    }
  };

  const nameField = (i: number, label: string) => (
    <Autocomplete
      key={i}
      ref={i === 0 ? firstRef : undefined}
      label={label}
      data={names}
      maxDropdownHeight={280}
      value={draft.names[i] ?? ''}
      onChange={(v) => setName(i, v)}
      error={i === 0 ? error : undefined}
      style={{ flex: 2, minWidth: 180 }}
      data-autofocus={i === 0 || undefined}
    />
  );

  return (
    <form onSubmit={submit}>
      <Group align="flex-start" wrap={inline ? 'wrap' : undefined}>
        {skatersPerEntry(type) === 1 && nameField(0, 'Skater')}
        {skatersPerEntry(type) === 2 && (
          <>
            {nameField(0, 'Skater 1')}
            {nameField(1, 'Skater 2')}
          </>
        )}
        {type === 'team' && (
          <TextInput
            ref={firstRef}
            label="Team name"
            value={draft.teamName}
            onChange={(e) => {
              setDraft({ ...draft, teamName: e.currentTarget.value });
              setError(null);
            }}
            error={error}
            style={{ flex: 2, minWidth: 180 }}
            data-autofocus
          />
        )}
        <Autocomplete
          label="Club"
          data={clubs}
          limit={8}
          value={draft.club}
          onChange={(v) => setDraft({ ...draft, club: v })}
          style={{ flex: 1, minWidth: 140 }}
        />
        {type === 'team' && (
          <TagsInput
            label="Members (optional)"
            data={names}
            value={draft.names}
            onChange={(v) => setDraft({ ...draft, names: v })}
            style={{ flex: 3, minWidth: 220 }}
            clearable
          />
        )}
        <Button type="submit" mt={25}>
          {submitLabel}
        </Button>
      </Group>
    </form>
  );
}
