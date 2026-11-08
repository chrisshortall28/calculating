import {
  Autocomplete,
  Button,
  Card,
  Group,
  Modal,
  Radio,
  Stack,
  Table,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { useDances, useJudges } from '../../app/data';
import { startsWithFilter } from '../../app/nameFilter';
import { countSectionMarks, setSectionJudge, type SectionMarks } from '../../db/repo';
import { byId } from '../../domain/entryName';
import { occupant, segmentPanel } from '../../domain/panels';
import { eventSegments, segmentNoun } from '../../domain/segments';
import type { CompEvent, Judge } from '../../domain/types';
import { resolveJudge } from './PanelJudgeModals';
import classes from './SectionJudges.module.css';

interface Edit {
  seatId: string;
  segmentId: string;
}

/**
 * Who judges each dance, figure or programme, when it is not the same panel throughout: a table of the
 * seats (J1…Jn) by part, each cell the judge in that seat for that part. Only shown when the event has
 * several parts and a panel.
 */
export function SectionJudges({ event }: { event: CompEvent }) {
  const dances = useDances(event.competitionId);
  const roster = useJudges(event.competitionId) ?? [];
  const judges = byId(roster);
  const segments = eventSegments(event, dances ?? []);
  const [edit, setEdit] = useState<Edit>();
  if (segments.length < 2 || event.judgeIds.length === 0) return null;

  const noun = segmentNoun(event);
  return (
    <Card withBorder>
      <Title order={5} mb={4}>
        Judges by section
      </Title>
      <Text size="sm" c="dimmed" mb="sm">
        If a different judge takes over a seat for a later {noun}, change it here. The seat’s sums still run
        over the whole event.
      </Text>
      <Table.ScrollContainer minWidth={360}>
        <Table verticalSpacing={4} fz="sm" withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>
                {noun === 'section' ? 'Section' : `${noun[0]!.toUpperCase()}${noun.slice(1)}`}
              </Table.Th>
              {event.judgeIds.map((_, i) => (
                <Table.Th key={i}>J{i + 1}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {segments.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>{s.name}</Table.Td>
                {event.judgeIds.map((seatId) => {
                  const who = occupant(event, s.id, seatId);
                  const changed = who !== seatId;
                  return (
                    <Table.Td key={seatId} className={changed ? classes.changed : undefined}>
                      <UnstyledButton
                        className={classes.cell}
                        onClick={() => setEdit({ seatId, segmentId: s.id })}
                        aria-label={`Change who judges ${s.name} in J${event.judgeIds.indexOf(seatId) + 1}`}
                      >
                        <span className={changed ? undefined : classes.same}>
                          {judges.get(who)?.name ?? '?'}
                        </span>
                      </UnstyledButton>
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <ChangeSectionJudge
        event={event}
        roster={roster}
        edit={edit}
        segments={segments}
        onClose={() => setEdit(undefined)}
      />
    </Card>
  );
}

type Scope = 'one' | 'later' | 'all';

function ChangeSectionJudge({
  event,
  roster,
  edit,
  segments,
  onClose,
}: {
  event: CompEvent;
  roster: Judge[];
  edit: Edit | undefined;
  segments: { id: string; name: string }[];
  onClose: () => void;
}) {
  return (
    <Modal
      opened={!!edit}
      onClose={onClose}
      centered
      title={
        edit
          ? `J${event.judgeIds.indexOf(edit.seatId) + 1} in ${segments.find((s) => s.id === edit.segmentId)?.name}`
          : ''
      }
    >
      {edit && (
        <SectionForm
          key={`${edit.seatId}|${edit.segmentId}`}
          event={event}
          roster={roster}
          edit={edit}
          segments={segments}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function SectionForm({
  event,
  roster,
  edit,
  segments,
  onClose,
}: {
  event: CompEvent;
  roster: Judge[];
  edit: Edit;
  segments: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { seatId, segmentId } = edit;
  const seatNo = event.judgeIds.indexOf(seatId) + 1;
  const index = segments.findIndex((s) => s.id === segmentId);
  const ownName = roster.find((j) => j.id === seatId)?.name ?? '?';
  const current = occupant(event, segmentId, seatId);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<Scope>('one');
  const [busy, setBusy] = useState(false);
  const [asking, { open: ask, close: stopAsking }] = useDisclosure(false);
  const [pending, setPending] = useState<{ id: string | null; count: number }>();

  const targets = (s: Scope) =>
    (s === 'one' ? [segments[index]!] : s === 'later' ? segments.slice(index) : segments).map((x) => x.id);
  const trimmed = name.trim();
  const sitting = new Set(segmentPanel(event, segmentId));
  const clash = roster.find(
    (j) => j.name.toLowerCase() === trimmed.toLowerCase() && sitting.has(j.id) && j.id !== current,
  );
  const options = roster.filter((j) => !sitting.has(j.id)).map((j) => j.name);

  const apply = async (id: string | null, marks: SectionMarks) => {
    setBusy(true);
    try {
      await setSectionJudge(event.id, targets(scope), seatId, id, marks);
      onClose();
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Could not change the judge',
        message: (e as Error).message,
      });
      setBusy(false);
      stopAsking();
    }
  };

  // Marks already entered by the judge being replaced: ask what should happen to them.
  const choose = async (id: string | null) => {
    const count = await countSectionMarks(event.id, targets(scope), seatId);
    if (count === 0) return void apply(id, 'move');
    setPending({ id, count });
    ask();
  };

  const useJudge = async (chosen: string) => {
    const n = chosen.trim();
    if (!n) return;
    const id = await resolveJudge(event.competitionId, n, roster);
    if (id === seatId) return void choose(null);
    await choose(id);
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed && !clash) void useJudge(trimmed);
        }}
      >
        <Stack>
          <Autocomplete
            label={`Who judges from J${seatNo}`}
            description="Pick an existing judge or type a new name"
            data={options}
            filter={startsWithFilter}
            value={name}
            onChange={setName}
            onOptionSubmit={(v) => void useJudge(v)}
            maxDropdownHeight={240}
            data-autofocus
            error={clash ? `${clash.name} already judges another seat in this part` : undefined}
          />
          <Radio.Group value={scope} onChange={(v) => setScope(v as Scope)} label="Applies to">
            <Stack gap={6} mt={6}>
              <Radio value="one" label={`${segments[index]?.name} only`} />
              {index < segments.length - 1 && (
                <Radio value="later" label={`${segments[index]?.name} and every later part`} />
              )}
              <Radio value="all" label="Every part" />
            </Stack>
          </Radio.Group>
          <Group justify="space-between">
            <Button variant="subtle" disabled={current === seatId} onClick={() => void choose(null)}>
              Back to {ownName}
            </Button>
            <Group>
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!trimmed || !!clash}>
                Change judge
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
      <Modal opened={asking} onClose={stopAsking} centered title="Marks already entered">
        <Stack>
          <Text size="sm">
            {pending?.count} mark{pending?.count === 1 ? ' has' : 's have'} already been entered by the judge
            in this seat. What should happen to {pending?.count === 1 ? 'it' : 'them'}?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={stopAsking}>
              Cancel
            </Button>
            <Button
              color="red"
              variant="light"
              loading={busy}
              onClick={() => void apply(pending!.id, 'delete')}
            >
              Delete them
            </Button>
            <Button loading={busy} onClick={() => void apply(pending!.id, 'move')}>
              Give them to the new judge
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
