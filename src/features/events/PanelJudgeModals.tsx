import { Autocomplete, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useMarks } from '../../app/data';
import { startsWithFilter } from '../../app/nameFilter';
import { addJudge, replaceEventJudge, updateJudge } from '../../db/repo';
import type { CompEvent, Judge } from '../../domain/types';

/** Finds a roster judge by name (case-insensitive), creating one if needed. */
export async function resolveJudge(competitionId: string, name: string, roster: Judge[]) {
  const existing = roster.find((j) => j.name.toLowerCase() === name.toLowerCase());
  return existing?.id ?? addJudge(competitionId, name);
}

const failed = (title: string, e: unknown) =>
  notifications.show({ color: 'red', title, message: (e as Error).message });

/** Fix a judge's name. It is the competition's judge record that is renamed, so it shows everywhere they judge. */
export function RenameJudgeModal({
  judge,
  roster,
  onClose,
}: {
  judge: Judge | undefined;
  roster: Judge[];
  onClose: () => void;
}) {
  return (
    <Modal opened={!!judge} onClose={onClose} title="Rename judge" centered>
      {judge && <RenameForm key={judge.id} judge={judge} roster={roster} onClose={onClose} />}
    </Modal>
  );
}

function RenameForm({ judge, roster, onClose }: { judge: Judge; roster: Judge[]; onClose: () => void }) {
  const [name, setName] = useState(judge.name);
  const trimmed = name.trim();
  const taken = roster.some((j) => j.id !== judge.id && j.name.toLowerCase() === trimmed.toLowerCase());
  const save = async () => {
    try {
      await updateJudge(judge.id, { name: trimmed });
      onClose();
    } catch (e) {
      failed('Could not rename', e);
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed && !taken && trimmed !== judge.name) void save();
      }}
    >
      <Stack>
        <TextInput
          label="Name"
          data-autofocus
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          error={taken ? 'Another judge already has this name' : undefined}
        />
        <Text size="xs" c="dimmed">
          This corrects the judge’s name in every event they judge. Their marks are not affected.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!trimmed || taken || trimmed === judge.name}>
            Rename
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/** Put a different judge in this judge's place for the whole event: the marks entered so far become theirs. */
export function ChangeJudgeModal({
  event,
  judge,
  seat,
  roster,
  onClose,
}: {
  event: CompEvent;
  judge: Judge | undefined;
  /** J1, J2… */
  seat: number;
  roster: Judge[];
  onClose: () => void;
}) {
  return (
    <Modal opened={!!judge} onClose={onClose} title={judge ? `Change J${seat} (${judge.name})` : ''} centered>
      {judge && <ChangeForm key={judge.id} event={event} judge={judge} roster={roster} onClose={onClose} />}
    </Modal>
  );
}

function ChangeForm({
  event,
  judge,
  roster,
  onClose,
}: {
  event: CompEvent;
  judge: Judge;
  roster: Judge[];
  onClose: () => void;
}) {
  const marks = useMarks(event.id);
  const entered = (marks ?? []).filter((m) => m.judgeId === judge.id).length;
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const sitting = new Set([
    ...event.judgeIds,
    ...Object.values(event.judgeSwaps ?? {}).flatMap((seats) => Object.values(seats)),
  ]);
  const options = roster.filter((j) => !sitting.has(j.id)).map((j) => j.name);
  const trimmed = name.trim();
  const clash = roster.find((j) => j.name.toLowerCase() === trimmed.toLowerCase() && sitting.has(j.id));

  const change = async (chosen: string) => {
    const n = chosen.trim();
    if (!n) return;
    setBusy(true);
    try {
      const id = await resolveJudge(event.competitionId, n, roster);
      await replaceEventJudge(event.id, judge.id, id);
      onClose();
    } catch (e) {
      failed('Could not change the judge', e);
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed && !clash) void change(trimmed);
      }}
    >
      <Stack>
        <Text size="sm">
          Use this when the wrong judge was picked. The new judge takes {judge.name}’s place in every dance,
          figure and programme of this event
          {entered > 0
            ? `, and the ${entered} mark${entered === 1 ? '' : 's'} entered so far become theirs`
            : ''}
          .
        </Text>
        <Autocomplete
          label="New judge"
          description="Pick an existing judge or type a new name"
          data={options}
          filter={startsWithFilter}
          value={name}
          onChange={setName}
          onOptionSubmit={(v) => void change(v)}
          maxDropdownHeight={240}
          data-autofocus
          error={clash ? `${clash.name} is already judging this event` : undefined}
        />
        <Text size="xs" c="dimmed">
          To have someone judge only some of the dances or figures, use “Judges by section” instead.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!trimmed || !!clash}>
            Change judge
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
