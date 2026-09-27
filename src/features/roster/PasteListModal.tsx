import { Button, Group, Modal, ScrollArea, Stack, Table, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { parsePastedList, type PastedRow } from '../../domain/pasteList';
import { entryNoun, skatersPerEntry } from '../../domain/entryName';
import type { EntryType } from '../../domain/types';

const rowKey = (r: PastedRow) => [r.teamName, ...[...r.names].sort()].join('|').toLowerCase();

const examples: Record<EntryType, string> = {
  solo: 'Jane Smith, Riverside RSC\nAmy Jones, Riverside RSC\nLucy Brown',
  duo: 'Jane Smith & Tom Smith, Riverside RSC\nAmy Jones & Ben Jones',
  couples: 'Jane Smith & Tom Smith, Riverside RSC\nAmy Jones & Ben Jones',
  team: 'Riverside Stars, Riverside RSC\nCity Flyers',
  single: 'Jane Smith, Riverside RSC\nAmy Jones, Riverside RSC\nLucy Brown',
  pairs: 'Jane Smith & Tom Smith, Riverside RSC\nAmy Jones & Ben Jones',
};

/**
 * Bulk entry: paste one line per skater (or duo / team), with an optional comma-separated club.
 * Previews what will be added before anything is saved.
 */
export function PasteListModal({
  opened,
  onClose,
  title,
  type,
  noun,
  skipReason,
  onAdd,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  type: EntryType;
  /** Plural noun for the add button, e.g. "skaters" or "entries". */
  noun: string;
  /** Why a row is already present and will be skipped (e.g. "Already entered"). */
  skipReason?: (row: PastedRow) => string | undefined;
  onAdd: (rows: PastedRow[]) => Promise<unknown>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const seen = new Set<string>();
  const preview = parsePastedList(text, type).map((row) => {
    const key = rowKey(row);
    const reason = row.error ?? (seen.has(key) ? 'Repeated above' : skipReason?.(row));
    seen.add(key);
    return { row, reason };
  });
  const toAdd = preview.filter((p) => !p.reason).map((p) => p.row);

  const close = () => {
    setText('');
    onClose();
  };

  const add = async () => {
    setBusy(true);
    try {
      await onAdd(toAdd);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title={title} size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          One {entryNoun[type][0]} per line. Add the club after a comma if you like — or paste name and club
          columns straight from a spreadsheet.
          {skatersPerEntry(type) === 2 && ' Separate partners with “&”.'}
        </Text>
        <Textarea
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          placeholder={examples[type]}
          autosize
          minRows={6}
          maxRows={12}
          data-autofocus
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
        />
        {preview.length > 0 && (
          <ScrollArea.Autosize mah={240}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{type === 'team' ? 'Team' : 'Skater'}</Table.Th>
                  <Table.Th>Club</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {preview.map(({ row, reason }, i) => (
                  <Table.Tr key={i} c={reason ? 'dimmed' : undefined}>
                    <Table.Td>{row.teamName || row.names.join(' & ') || '—'}</Table.Td>
                    <Table.Td>{row.club || '—'}</Table.Td>
                    <Table.Td>
                      <Text size="xs" c={row.error ? 'red' : 'dimmed'}>
                        {reason ?? ''}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button onClick={add} disabled={!toAdd.length} loading={busy}>
            Add {toAdd.length || ''} {noun}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
