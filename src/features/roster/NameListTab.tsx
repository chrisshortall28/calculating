import { ActionIcon, Button, Card, Group, Stack, Table, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconTrash } from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { InlineEdit } from './InlineEdit';
import { RosterNote } from './RosterNote';

interface Item {
  id: string;
  name: string;
}

/** Add / rename / delete list used for judges and dances. */
export function NameListTab({
  noun,
  intro,
  items,
  usage,
  usageLabel,
  deleteWarning,
  onAdd,
  onRename,
  onDelete,
}: {
  noun: string;
  intro?: ReactNode;
  items: Item[] | undefined;
  usage: Map<string, number> | undefined;
  usageLabel: string;
  deleteWarning: (item: Item, used: number) => ReactNode;
  onAdd: (name: string) => unknown;
  onRename: (id: string, name: string) => unknown;
  onDelete: (id: string) => unknown;
}) {
  const [name, setName] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onAdd(name.trim());
    setName('');
  };

  const remove = (item: Item) =>
    modals.openConfirmModal({
      title: `Delete ${noun}`,
      children: <Text size="sm">{deleteWarning(item, usage?.get(item.id) ?? 0)}</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => onDelete(item.id),
    });

  return (
    <Stack maw={640}>
      {intro && <RosterNote>{intro}</RosterNote>}
      <Card withBorder>
        <form onSubmit={add}>
          <Group align="flex-end" mb="md">
            <TextInput
              label={`${noun[0]!.toUpperCase()}${noun.slice(1)} name`}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button type="submit">Add {noun}</Button>
          </Group>
        </form>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th w={80}>{usageLabel}</Table.Th>
              <Table.Th w={50} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items?.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>
                  <InlineEdit value={item.name} onSave={(v) => onRename(item.id, v)} required />
                </Table.Td>
                <Table.Td>{usage?.get(item.id) ?? 0}</Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => remove(item)}
                    aria-label={`Delete ${noun}`}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
