import { Button, Group, Modal, ScrollArea, Select, Stack, Table, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { analysePaste, parsePastedList, type PasteColumn, type PastedRow } from '../../domain/pasteList';
import { entryNoun, skatersPerEntry } from '../../domain/entryName';
import type { EntryType } from '../../domain/types';

/** What a spreadsheet column can hold, for the entry type. */
function columnOptions(type: EntryType): { value: PasteColumn; label: string }[] {
  if (type === 'team')
    return [
      { value: 'name', label: 'Team name' },
      { value: 'club', label: 'Club' },
      { value: 'ignore', label: 'Ignore' },
    ];
  const person = [
    { value: 'first' as const, label: 'First name' },
    { value: 'surname' as const, label: 'Surname' },
    { value: 'name' as const, label: 'Full name' },
  ];
  const partner =
    skatersPerEntry(type) === 2
      ? [
          { value: 'partnerFirst' as const, label: 'Partner first name' },
          { value: 'partnerSurname' as const, label: 'Partner surname' },
          { value: 'partner' as const, label: 'Partner full name' },
        ]
      : [];
  return [...person, ...partner, { value: 'club', label: 'Club' }, { value: 'ignore', label: 'Ignore' }];
}

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
  /** What the user says each spreadsheet column holds, once they change one. */
  const [chosen, setChosen] = useState<PasteColumn[] | null>(null);

  const table = analysePaste(text, type);
  const columns = table && chosen?.length === table.columns.length ? chosen : undefined;
  const shown = columns ?? table?.columns;

  const seen = new Set<string>();
  const preview = parsePastedList(text, type, columns).map((row) => {
    const key = rowKey(row);
    const reason = row.error ?? (seen.has(key) ? 'Repeated above' : skipReason?.(row));
    seen.add(key);
    return { row, reason };
  });
  const toAdd = preview.filter((p) => !p.reason).map((p) => p.row);

  const close = () => {
    setText('');
    setChosen(null);
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
          One {entryNoun[type][0]} per line. Add the club after a comma if you like — or paste columns
          straight from a spreadsheet: first name and surname can be separate, and columns such as Age are
          ignored.
          {skatersPerEntry(type) === 2 && ' Separate partners with “&”.'}
        </Text>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.currentTarget.value);
            // A new paste starts from what its own header says.
            if (!e.currentTarget.value.trim()) setChosen(null);
          }}
          placeholder={examples[type]}
          autosize
          minRows={6}
          maxRows={12}
          data-autofocus
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
        />
        {table && shown && (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {table.header ? 'Columns found — check what each holds' : 'Columns — say what each holds'}
            </Text>
            <Group gap="xs" align="flex-start">
              {shown.map((role, i) => (
                <Select
                  key={i}
                  size="xs"
                  w={150}
                  allowDeselect={false}
                  label={table.header?.[i] || `Column ${i + 1}`}
                  description={table.sample[i] || '(empty)'}
                  aria-label={`Column ${i + 1}: ${table.header?.[i] ?? table.sample[i] ?? ''}`}
                  data={columnOptions(type)}
                  value={role}
                  onChange={(v) => {
                    if (!v) return;
                    const next = [...shown];
                    next[i] = v as PasteColumn;
                    setChosen(next);
                  }}
                />
              ))}
            </Group>
          </Stack>
        )}
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
