import { ActionIcon, Button, Card, Group, Modal, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconArrowDown,
  IconArrowUp,
  IconClipboardList,
  IconDice5,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useEntries, useSkaters } from '../../app/data';
import { SortableList } from '../../app/SortableList';
import { db } from '../../db/db';
import { addEntry, deleteEntry, entryTypeLabel, reorderEntries, updateEntry } from '../../db/repo';
import { shuffled } from '../../domain/shuffle';
import { byId, entryClub, entryMembers, entryName } from '../../domain/entryName';
import type { PastedRow } from '../../domain/pasteList';
import type { CompEvent, Entry } from '../../domain/types';
import { PasteListModal } from '../roster/PasteListModal';
import { draftFromEntry, draftToEntry, EntryForm } from './EntryForm';

export function EntriesTab({ event }: { event: CompEvent }) {
  const entries = useEntries(event.id) ?? [];
  const skaterList = useSkaters(event.competitionId) ?? [];
  const skaters = byId(skaterList);
  const markCounts = useLiveQuery(async () => {
    const counts = new Map<string, number>();
    await db.marks
      .where({ eventId: event.id })
      .each((m) => counts.set(m.entryId, (counts.get(m.entryId) ?? 0) + 1));
    return counts;
  }, [event.id]);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [pasting, setPasting] = useState(false);

  // Entries are matched by team name, or by their set of skater names in any order.
  const nameKey = (teamName: string | undefined, names: string[]) =>
    (teamName || [...names].sort().join('|')).toLowerCase();
  const pastedKey = (row: PastedRow) => nameKey(row.teamName, row.names);
  const enteredKeys = new Set(
    entries.map((e) =>
      nameKey(
        e.teamName,
        e.skaterIds.map((id) => skaters.get(id)?.name ?? ''),
      ),
    ),
  );

  const addPasted = async (rows: PastedRow[]) => {
    for (const row of rows) {
      // Re-read so skaters created by earlier lines are reused, not duplicated.
      const known = await db.skaters.where({ competitionId: event.competitionId }).toArray();
      await addEntry(event.id, await draftToEntry(event.competitionId, event.entryType, row, known));
    }
    notifications.show({ color: 'green', message: `Added ${rows.length} entries` });
  };

  const warnDuplicates = (skaterIds: string[], exceptEntryId?: string) => {
    const dupes = skaterIds.filter((id) =>
      entries.some((e) => e.id !== exceptEntryId && e.skaterIds.includes(id)),
    );
    if (dupes.length)
      notifications.show({
        color: 'orange',
        message: `${dupes.map((id) => skaters.get(id)?.name).join(', ')} already entered in this event`,
      });
  };

  const move = (index: number, delta: number) => {
    const ids = entries.map((e) => e.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id!);
    void reorderEntries(ids);
  };

  const remove = (entry: Entry) => {
    const marks = markCounts?.get(entry.id) ?? 0;
    modals.openConfirmModal({
      title: 'Remove entry',
      children: (
        <Text size="sm">
          Remove {entryName(entry, skaters)} from this event?
          {marks > 0 && ` Their ${marks} entered marks will be deleted.`}
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteEntry(entry.id),
    });
  };

  return (
    <Stack>
      <Card withBorder>
        <EntryForm
          inline
          type={event.entryType}
          skaters={skaterList}
          submitLabel="Add"
          onSubmit={async (draft) => {
            const data = await draftToEntry(event.competitionId, event.entryType, draft, skaterList);
            warnDuplicates(data.skaterIds);
            await addEntry(event.id, data);
          }}
        />
      </Card>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {entries.length} entries in start order · drag, or use the arrows, to reorder
        </Text>
        <Group gap="xs">
          <Button
            variant="light"
            size="xs"
            leftSection={<IconDice5 size={16} />}
            disabled={entries.length < 2}
            onClick={() => void reorderEntries(shuffled(entries.map((e) => e.id)))}
          >
            Randomise order
          </Button>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconClipboardList size={16} />}
            onClick={() => setPasting(true)}
          >
            Paste list
          </Button>
        </Group>
      </Group>

      <div>
        <SortableList
          items={entries}
          onReorder={reorderEntries}
          renderItem={(entry, index, handle) => (
            <Paper withBorder px="sm" py={6} mb={4}>
              <Group wrap="nowrap" gap="sm">
                {handle}
                <Text fw={700} w={28} ta="right" c="dimmed">
                  {index + 1}
                </Text>
                <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={500} truncate>
                    {entryName(entry, skaters)}
                  </Text>
                  {event.entryType === 'team' && entry.skaterIds.length > 0 && (
                    <Text size="xs" c="dimmed" truncate>
                      {entryMembers(entry, skaters)}
                    </Text>
                  )}
                </Stack>
                <Text size="sm" c="dimmed" w={180} truncate>
                  {entryClub(entry, skaters)}
                </Text>
                <Group gap={2} wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label="Move up"
                  >
                    <IconArrowUp size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    disabled={index === entries.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label="Move down"
                  >
                    <IconArrowDown size={16} />
                  </ActionIcon>
                  <Tooltip label="Edit">
                    <ActionIcon variant="subtle" onClick={() => setEditing(entry)} aria-label="Edit entry">
                      <IconPencil size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Remove">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => remove(entry)}
                      aria-label="Remove entry"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Paper>
          )}
        />
      </div>

      <PasteListModal
        opened={pasting}
        onClose={() => setPasting(false)}
        title={`Paste ${entryTypeLabel[event.entryType].toLowerCase()} entries`}
        type={event.entryType}
        noun="entries"
        skipReason={(row) => (enteredKeys.has(pastedKey(row)) ? 'Already entered' : undefined)}
        onAdd={addPasted}
      />

      <Modal opened={!!editing} onClose={() => setEditing(null)} title="Edit entry" size="xl">
        {editing && (
          <EntryForm
            key={editing.id}
            type={event.entryType}
            skaters={skaterList}
            initial={draftFromEntry(editing, event.entryType, skaters)}
            submitLabel="Save"
            onSubmit={async (draft) => {
              const data = await draftToEntry(event.competitionId, event.entryType, draft, skaterList);
              warnDuplicates(data.skaterIds, editing.id);
              await updateEntry(editing.id, data);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}
