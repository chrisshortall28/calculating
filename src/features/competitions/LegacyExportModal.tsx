import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconDownload } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { Id } from '../../domain/types';
import { exportCompetition, fileNameFor, type CompetitionFile } from '../../io/competitionFile';
import { createZip, downloadBytes } from '../../io/zip';
import { exportLegacyEvents, type LegacyExport } from '../../legacy/export';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Exports a competition's dance events as Calculating For Windows files, in a .zip. */
export function LegacyExportModal({
  competitionId,
  opened,
  onClose,
}: {
  competitionId: Id;
  opened: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<{ file: CompetitionFile; result: LegacyExport } | null>(null);

  useEffect(() => {
    if (!opened) return;
    let current = true;
    setState(null);
    exportCompetition(competitionId)
      .then((file) => current && setState({ file, result: exportLegacyEvents(file) }))
      .catch((e: Error) => {
        notifications.show({ color: 'red', title: 'Export failed', message: e.message });
        onClose();
      });
    return () => {
      current = false;
    };
  }, [opened, competitionId, onClose]);

  const download = () => {
    if (!state) return;
    const zip = createZip(state.result.files.map((f) => ({ name: f.name, data: f.data })));
    downloadBytes(
      zip,
      fileNameFor(`${state.file.competition.name} Calculating For Windows`, 'zip'),
      'application/zip',
    );
    notifications.show({ color: 'green', message: `Exported ${plural(state.result.files.length, 'event')}` });
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Export for Calculating For Windows" size="xl">
      {!state ? (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      ) : (
        <Review result={state.result} onDownload={download} onClose={onClose} />
      )}
    </Modal>
  );
}

function Review({
  result,
  onDownload,
  onClose,
}: {
  result: LegacyExport;
  onDownload: () => void;
  onClose: () => void;
}) {
  const warnings = result.warnings.filter((w) => w.level === 'warning');
  return (
    <Stack>
      <Text size="sm">
        Dance events with compulsory dances or a free dance are exported as one <code>DATAnnnB.ROL</code> file
        each, together in a <code>.zip</code>. Unzip them into a folder to open in Calculating For Windows.
        Check an exported competition there before relying on it.
      </Text>

      {result.files.length === 0 ? (
        <Alert color="red" icon={<IconAlertTriangle size={18} />} title="Nothing to export">
          None of this competition’s events can be exported yet.
        </Alert>
      ) : (
        <ScrollArea.Autosize mah={240} type="auto">
          <Table verticalSpacing={4} fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>File</Table.Th>
                <Table.Th>Event</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.files.map((f) => (
                <Table.Tr key={f.name}>
                  <Table.Td>
                    <code>{f.name}</code>
                  </Table.Td>
                  <Table.Td>{f.event}</Table.Td>
                </Table.Tr>
              ))}
              {result.skipped.map((s) => (
                <Table.Tr key={s.event} c="dimmed">
                  <Table.Td>
                    <Badge color="red" variant="light">
                      Not exported
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {s.event}: {s.reason}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      )}

      {warnings.length > 0 && (
        <Alert
          color="yellow"
          icon={<IconAlertTriangle size={18} />}
          title={`${plural(warnings.length, 'thing')} to check`}
        >
          <ScrollArea.Autosize mah={140} type="auto">
            <List size="sm" spacing={2}>
              {warnings.map((w, i) => (
                <List.Item key={i}>
                  {w.event ? <b>{w.event}: </b> : null}
                  {w.message}
                </List.Item>
              ))}
            </List>
          </ScrollArea.Autosize>
        </Alert>
      )}

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button
          color="medal.5"
          c="navy.9"
          leftSection={<IconDownload size={16} />}
          disabled={result.files.length === 0}
          onClick={onDownload}
        >
          Download .zip
        </Button>
      </Group>
    </Stack>
  );
}
