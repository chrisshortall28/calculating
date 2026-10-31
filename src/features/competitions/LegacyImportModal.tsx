import {
  Accordion,
  Alert,
  Badge,
  Button,
  type ButtonProps,
  Group,
  List,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconFileImport, IconFolderOpen, IconUpload } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { formatLongDate } from '../../app/format';
import type { EntryType } from '../../domain/types';
import { db } from '../../db/db';
import { entryTypeLabel } from '../../db/repo';
import { importCompetition, parseCompetitionFile } from '../../io/competitionFile';
import { convertLegacyCompetition, type LegacyChoices, type LegacyIssues } from '../../legacy/convert';
import { readLegacyFiles, type LegacyFilesRead } from '../../legacy/readFiles';
import { summariseConversion } from '../../legacy/summary';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Import legacy" button: opens the flow for competitions from the Calculating For Windows application. */
export function ImportLegacyButton(props: ButtonProps) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Button leftSection={<IconFileImport size={16} />} {...props} onClick={open}>
        {props.children ?? 'Import legacy'}
      </Button>
      <LegacyImportModal opened={opened} onClose={close} />
    </>
  );
}

export function LegacyImportModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [read, setRead] = useState<LegacyFilesRead | null>(null);
  const [chosen, setChosen] = useState(0);
  const [busy, setBusy] = useState(false);
  const reset = () => {
    setRead(null);
    setChosen(0);
  };
  const close = () => {
    onClose();
    reset();
  };

  const onFiles = async (files: File[]) => {
    setBusy(true);
    try {
      const data = await Promise.all(
        files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })),
      );
      setChosen(0);
      setRead(readLegacyFiles(data));
    } catch (e) {
      notifications.show({ color: 'red', title: 'Could not read the files', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title="Import from Calculating For Windows" size="xl">
      {read && read.competitions.length > 0 ? (
        <Review read={read} chosen={chosen} onChoose={setChosen} onBack={reset} onDone={close} />
      ) : (
        <ChooseFiles busy={busy} read={read} onFiles={onFiles} />
      )}
    </Modal>
  );
}

function ChooseFiles({
  busy,
  read,
  onFiles,
}: {
  busy: boolean;
  read: LegacyFilesRead | null;
  onFiles: (files: File[]) => void;
}) {
  const folderInput = useRef<HTMLInputElement>(null);
  return (
    <Stack>
      <Text size="sm">
        Choose all of a competition’s event files (<code>DATAnnnB.ROL</code>), or drop their folder here.
        Other files in the folder, such as <code>roller.tlg</code>, are ignored.
      </Text>
      <Dropzone onDrop={onFiles} loading={busy} multiple>
        <Group justify="center" gap="md" mih={110} style={{ pointerEvents: 'none' }}>
          <IconUpload size={36} color="var(--mantine-color-dimmed)" />
          <div>
            <Text fw={600}>Drop files or a folder here, or click to choose files</Text>
            <Text size="sm" c="dimmed">
              Nothing is uploaded anywhere: the files are read on this device.
            </Text>
          </div>
        </Group>
      </Dropzone>
      <Group>
        <input
          ref={folderInput}
          type="file"
          hidden
          multiple
          // Not in React's types: lets the user pick a whole folder.
          {...{ webkitdirectory: '' }}
          onChange={(e) => {
            const files = [...(e.currentTarget.files ?? [])];
            e.currentTarget.value = '';
            if (files.length > 0) onFiles(files);
          }}
        />
        <Button
          variant="default"
          leftSection={<IconFolderOpen size={16} />}
          onClick={() => folderInput.current?.click()}
        >
          Choose a folder
        </Button>
      </Group>
      {read && <NothingFound read={read} />}
    </Stack>
  );
}

function NothingFound({ read }: { read: LegacyFilesRead }) {
  return (
    <Stack gap="xs">
      {read.unreadable.length === 0 && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />} title="No competition found">
          None of those files are Calculating For Windows event files (DATAnnnB.ROL).
        </Alert>
      )}
      <FileProblems read={read} intro="No competition found: these files could not be read" />
    </Stack>
  );
}

function FileProblems({ read, intro }: { read: LegacyFilesRead; intro?: string }) {
  return (
    <>
      {read.unreadable.length > 0 && (
        <Alert
          color="orange"
          icon={<IconAlertTriangle size={18} />}
          title={intro ?? 'Some files could not be read'}
        >
          <List size="sm">
            {read.unreadable.map((f) => (
              <List.Item key={f.name}>{f.message}</List.Item>
            ))}
          </List>
        </Alert>
      )}
      {read.ignored.length > 0 && (
        <Text size="sm" c="dimmed">
          Ignored {plural(read.ignored.length, 'other file')}: {read.ignored.slice(0, 5).join(', ')}
          {read.ignored.length > 5 ? ', …' : ''}.
        </Text>
      )}
    </>
  );
}

/** The entry types a Solo Dance event can have. */
const DANCE_ENTRY_TYPES = (['solo', 'duo', 'couples', 'team'] as const).map((t) => ({
  value: t,
  label: entryTypeLabel[t],
}));

/** What the files do not say (apart from entry types, which the table asks): answer here instead of fixing it after the import. */
function FillIn({
  issues,
  date,
  choices,
  onChange,
}: {
  issues: LegacyIssues;
  date: string;
  choices: LegacyChoices;
  onChange: (choices: LegacyChoices) => void;
}) {
  if (!issues.date && issues.unknownDances.length === 0) return null;
  return (
    <Alert
      color="yellow"
      icon={<IconAlertTriangle size={18} />}
      title="Missing information you could help clarify"
    >
      <Stack gap="xs">
        {issues.date && (
          <TextInput
            type="date"
            label="Date"
            description={`The date in the files, “${issues.date.text}”, could not be read.`}
            value={date}
            onChange={(e) => onChange({ ...choices, date: e.currentTarget.value })}
          />
        )}
        {issues.unknownDances.map((d) => (
          <TextInput
            key={d.code}
            label={`Dance number ${d.code}`}
            description={`Podium does not know this dance. Used in ${d.events.join(', ')}.`}
            placeholder={d.defaultName}
            value={choices.danceNames?.[d.code] ?? ''}
            onChange={(e) =>
              onChange({ ...choices, danceNames: { ...choices.danceNames, [d.code]: e.currentTarget.value } })
            }
          />
        ))}
      </Stack>
    </Alert>
  );
}

function Review({
  read,
  chosen,
  onChoose,
  onBack,
  onDone,
}: {
  read: LegacyFilesRead;
  chosen: number;
  onChoose: (i: number) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);
  const [choices, setChoices] = useState<LegacyChoices>({});
  const conversion = useMemo(
    () => convertLegacyCompetition(read.competitions[chosen]!, choices),
    [read, chosen, choices],
  );
  const summary = useMemo(() => summariseConversion(conversion), [conversion]);
  const existing = useLiveQuery(async () => {
    const name = summary.competition.name.toLowerCase();
    return (await db.competitions.toArray()).find(
      (c) => c.name.toLowerCase() === name && c.date === summary.competition.date,
    );
  }, [summary.competition.name, summary.competition.date]);

  const doImport = async () => {
    setImporting(true);
    try {
      const id = await importCompetition(parseCompetitionFile(conversion.file), 'replace');
      notifications.show({
        color: 'green',
        message: `Imported “${summary.competition.name}” (${plural(summary.counts.events, 'event')})`,
      });
      onDone();
      navigate(`/c/${id}`);
    } catch (e) {
      notifications.show({ color: 'red', title: 'Import failed', message: (e as Error).message });
      setImporting(false);
    }
  };

  const { competition, counts } = summary;
  return (
    <Stack>
      {read.competitions.length > 1 && (
        <Select
          label="These files hold more than one competition. Import which?"
          allowDeselect={false}
          value={String(chosen)}
          onChange={(v) => {
            setChoices({});
            onChoose(Number(v));
          }}
          data={read.competitions.map((c, i) => ({
            value: String(i),
            label: `${c.name || 'Unnamed'} — ${plural(c.events.length, 'event')}`,
          }))}
        />
      )}

      <div>
        <Text fw={700} fz="lg">
          {competition.name}
        </Text>
        <Text size="sm" c="dimmed">
          {[formatLongDate(competition.date), competition.venue].filter(Boolean).join(' · ')}
        </Text>
      </div>
      <Group gap="xs">
        <Badge variant="light">{plural(counts.events, 'event')}</Badge>
        <Badge variant="light">{plural(counts.skaters, 'skater')}</Badge>
        <Badge variant="light">{plural(counts.judges, 'judge')}</Badge>
        <Badge variant="light">{plural(counts.marks, 'mark')}</Badge>
      </Group>

      {existing && (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
          “{existing.name}” on the same date is already on this device. Importing adds another competition; it
          does not replace it.
        </Alert>
      )}

      <ScrollArea.Autosize mah={260} type="auto">
        <Table stickyHeader verticalSpacing={4} fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Event</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th ta="right">Entries</Table.Th>
              <Table.Th ta="right">Marks</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {summary.events.map((e, i) => (
              <Table.Tr key={i}>
                <Table.Td>{e.name}</Table.Td>
                {(() => {
                  const guessed = conversion.issues.guessedTypes.find((g) => g.eventId === e.id);
                  if (!guessed)
                    return (
                      <Table.Td>
                        {entryTypeLabel[e.entryType]}
                        {e.figures ? ' · figures' : ''}
                      </Table.Td>
                    );
                  return (
                    <Table.Td style={{ borderLeft: '3px solid var(--mantine-color-yellow-6)' }}>
                      <Tooltip label="The files do not say whether these are solos, duos, couples or teams. This is a guess from the names: please check it.">
                        <Select
                          size="xs"
                          w={150}
                          aria-label={`Entries in ${e.name}`}
                          leftSection={<IconAlertTriangle size={14} color="var(--mantine-color-yellow-6)" />}
                          allowDeselect={false}
                          data={DANCE_ENTRY_TYPES}
                          value={e.entryType}
                          onChange={(v) =>
                            v &&
                            setChoices({
                              ...choices,
                              entryTypes: { ...choices.entryTypes, [guessed.index]: v as EntryType },
                            })
                          }
                        />
                      </Tooltip>
                    </Table.Td>
                  );
                })()}
                <Table.Td ta="right">{e.entries}</Table.Td>
                <Table.Td ta="right">{e.marks || '—'}</Table.Td>
              </Table.Tr>
            ))}
            {summary.skipped.map((name) => (
              <Table.Tr key={`skipped-${name}`} c="dimmed">
                <Table.Td>{name}</Table.Td>
                <Table.Td colSpan={3}>
                  <Badge color="red" variant="light">
                    Not imported
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>

      <FillIn issues={conversion.issues} date={competition.date} choices={choices} onChange={setChoices} />

      {summary.warnings.length > 0 && (
        <Alert
          color="yellow"
          icon={<IconAlertTriangle size={18} />}
          title={`${plural(summary.warnings.length, 'thing')} to check`}
        >
          <ScrollArea.Autosize mah={140} type="auto">
            <List size="sm" spacing={2}>
              {summary.warnings.map((w, i) => (
                <List.Item key={i}>
                  {w.event ? <b>{w.event}: </b> : null}
                  {w.message}
                </List.Item>
              ))}
            </List>
          </ScrollArea.Autosize>
        </Alert>
      )}
      {summary.notes.length > 0 && (
        <Accordion variant="contained">
          <Accordion.Item value="notes">
            <Accordion.Control>
              <Text size="sm">{plural(summary.notes.length, 'note')}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <ScrollArea.Autosize mah={140} type="auto">
                <List size="sm" spacing={2}>
                  {summary.notes.map((w, i) => (
                    <List.Item key={i}>
                      {w.event ? <b>{w.event}: </b> : null}
                      {w.message}
                    </List.Item>
                  ))}
                </List>
              </ScrollArea.Autosize>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}
      <FileProblems read={read} />

      <Group justify="flex-end">
        <Button variant="default" onClick={onBack} disabled={importing}>
          Back
        </Button>
        <Button
          color="medal.5"
          c="navy.9"
          onClick={doImport}
          loading={importing}
          disabled={counts.events === 0}
        >
          Import competition
        </Button>
      </Group>
    </Stack>
  );
}
