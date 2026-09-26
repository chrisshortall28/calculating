import { ActionIcon, Card, Group, Modal, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconArrowDown, IconArrowUp, IconPencil, IconTrash } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useEntries, useSkaters } from '../../app/data';
import { SortableList } from '../../app/SortableList';
import { db } from '../../db/db';
import { addEntry, deleteEntry, reorderEntries, updateEntry } from '../../db/repo';
import { byId, entryClub, entryMembers, entryName } from '../../domain/entryName';
import type { CompEvent, Entry } from '../../domain/types';
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

      <Text size="sm" c="dimmed">
        {entries.length} entries in start order · drag, or use the arrows, to reorder
      </Text>

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
