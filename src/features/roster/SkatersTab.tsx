import { ActionIcon, Button, Card, Group, Table, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconTrash } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useSkaters } from '../../app/data';
import { db } from '../../db/db';
import { addSkater, deleteSkater, updateSkater } from '../../db/repo';
import { InlineEdit } from './InlineEdit';

export function SkatersTab() {
  const { compId } = useParams() as { compId: string };
  const skaters = useSkaters(compId);
  const usage = useLiveQuery(async () => {
    const counts = new Map<string, number>();
    const eventIds = await db.events.where({ competitionId: compId }).primaryKeys();
    await db.entries
      .where('eventId')
      .anyOf(eventIds)
      .each((e) => e.skaterIds.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1)));
    return counts;
  }, [compId]);
  const [name, setName] = useState('');
  const [club, setClub] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await addSkater(compId, { name: name.trim(), club: club.trim() });
    setName('');
    nameRef.current?.focus(); // keep the club for quick entry of club-mates
  };

  const remove = (id: string, skaterName: string) =>
    modals.openConfirmModal({
      title: 'Delete skater',
      children: (
        <Text size="sm">
          Delete {skaterName}? They will be removed from {usage?.get(id) ?? 0} event entries; entries left
          with no skaters are deleted with their marks.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteSkater(id),
    });

  return (
    <Card withBorder>
      <form onSubmit={add}>
        <Group align="flex-end" mb="md">
          <TextInput
            ref={nameRef}
            label="Skater name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            style={{ flex: 2 }}
          />
          <TextInput
            label="Club"
            value={club}
            onChange={(e) => setClub(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button type="submit">Add skater</Button>
        </Group>
      </form>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Club</Table.Th>
            <Table.Th w={80}>Entries</Table.Th>
            <Table.Th w={50} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {skaters?.map((s) => (
            <Table.Tr key={s.id}>
              <Table.Td>
                <InlineEdit value={s.name} onSave={(v) => updateSkater(s.id, { name: v })} required />
              </Table.Td>
              <Table.Td>
                <InlineEdit value={s.club} onSave={(v) => updateSkater(s.id, { club: v })} placeholder="—" />
              </Table.Td>
              <Table.Td>{usage?.get(s.id) ?? 0}</Table.Td>
              <Table.Td>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => remove(s.id, s.name)}
                  aria-label="Delete skater"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {skaters?.length === 0 && (
        <Text c="dimmed" ta="center" py="md">
          No skaters yet. You can also add skaters directly when adding entries to an event.
        </Text>
      )}
    </Card>
  );
}
