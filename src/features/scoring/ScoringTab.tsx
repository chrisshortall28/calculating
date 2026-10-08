import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Kbd,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconEraser, IconLock, IconLockOpen } from '@tabler/icons-react';
import { useMemo, useRef, useState } from 'react';
import { useJudges, useSkaters } from '../../app/data';
import { clearMarks, setEventStatus, setMark } from '../../db/repo';
import { byId, entryClub, entryHeading, entryName } from '../../domain/entryName';
import type { CompEvent } from '../../domain/types';
import type { Direction } from '../../marks/gridNav';
import { MarkGrid } from '../../marks/MarkGrid';
import { NumberPad } from '../../marks/NumberPad';
import { SegmentPicker } from './SegmentPicker';
import { markKey, useEventResult } from './useEventResult';

const fitWidth = {
  width: 'fit-content',
  minWidth: 'min(100%, calc(var(--container-size-xl) - 2 * var(--mantine-spacing-md)))',
  maxWidth: '100%',
  marginInline: 'auto',
};

export function ScoringTab({ event }: { event: CompEvent }) {
  const { loading, segments, entries, markMap, result } = useEventResult(event);
  const skaters = byId(useSkaters(event.competitionId));
  const judgeMap = byId(useJudges(event.competitionId));
  const [direction, setDirection] = useLocalStorage<Direction>({
    key: 'podium.direction',
    defaultValue: 'down',
  });
  const [autoAdvance, setAutoAdvance] = useLocalStorage({ key: 'podium.autoAdvance', defaultValue: true });
  const [numberPad, setNumberPad] = useLocalStorage({ key: 'podium.numberPad', defaultValue: false });
  const focusedInput = useRef<HTMLInputElement | null>(null);
  const [segmentId, setSegmentId] = useState<string | null>(null);

  // Open on the first incomplete dance, then stay put: finishing a dance shouldn't switch the grid away.
  const firstIncomplete = result.segments.find((s) => !s.complete)?.segmentId;
  const initialId = firstIncomplete ?? segments[0]?.id;
  if (segmentId === null && !loading && initialId) setSegmentId(initialId);
  const activeId = segmentId ?? initialId;
  const segment = segments.find((s) => s.id === activeId) ?? segments[0];
  const segResult = result.segments.find((s) => s.segmentId === segment?.id);
  const locked = event.status === 'final';

  const judges = event.judgeIds.map((id) => ({ id, name: judgeMap.get(id)?.name ?? '?' }));
  const rows = useMemo(
    () =>
      entries.map((e) => ({
        id: e.id,
        label: entryName(e, skaters),
        sub: entryClub(e, skaters),
      })),
    [entries, skaters],
  );

  // Only show a judge's ordinals once all their marks for this segment are in.
  const ordinals = useMemo(() => {
    if (!segment || !segResult) return undefined;
    const shown = new Map<string, Map<string, number>>();
    for (const j of event.judgeIds) {
      const complete = entries.every((e) => segment.markKeys.every((k) => markMap.has(markKey(k, j, e.id))));
      if (complete) shown.set(j, segResult.ordinals.get(j)!);
    }
    return shown;
  }, [segment, segResult, event.judgeIds, entries, markMap]);

  if (loading) return null;
  if (!segment)
    return (
      <Alert color="orange">
        {event.discipline === 'figures'
          ? 'This event has no figures or programmes. Add compulsory figures or a short or free programme in Setup.'
          : 'This event has no dances. Add compulsory dances or a free dance in Setup.'}
      </Alert>
    );

  const entered = result.totalMarks - result.missingMarks;

  const toggleLock = () => {
    if (!locked) {
      if (!result.complete)
        return modals.openConfirmModal({
          title: 'Marks missing',
          children: (
            <Text size="sm">
              {result.missingMarks} marks are still missing. Mark the event as final anyway?
            </Text>
          ),
          labels: { confirm: 'Mark final', cancel: 'Cancel' },
          onConfirm: () => setEventStatus(event.id, 'final'),
        });
      return void setEventStatus(event.id, 'final');
    }
    modals.openConfirmModal({
      title: 'Unlock event',
      children: <Text size="sm">This event is final. Unlock it to change marks?</Text>,
      labels: { confirm: 'Unlock', cancel: 'Cancel' },
      onConfirm: () => setEventStatus(event.id, 'scoring'),
    });
  };

  const confirmClear = () =>
    modals.openConfirmModal({
      title: 'Clear all marks',
      children: (
        <Text size="sm">
          Delete all {entered} marks entered for this event, in every dance and from every judge? This can’t
          be undone.
        </Text>
      ),
      labels: { confirm: 'Clear marks', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => clearMarks(event.id),
    });

  return (
    // Centred and as wide as the mark grid needs: the usual page width for a typical panel,
    // growing towards the window edges (then scrolling) as judges are added.
    <Stack style={fitWidth}>
      {/* Always-present options and actions, apart from the event-specific controls below. */}
      <Paper
        withBorder
        shadow="xs"
        radius="md"
        px="md"
        py="xs"
        bg="light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-5))"
        style={{ borderColor: 'light-dark(var(--mantine-color-gray-5), var(--mantine-color-dark-3))' }}
      >
        <Group justify="space-between" gap="md">
          <Group gap="md">
            <SegmentedControl
              size="xs"
              value={direction}
              onChange={(v) => setDirection(v as Direction)}
              data={[
                { value: 'down', label: '↓ Judge by judge' },
                { value: 'across', label: '→ Entry by entry' },
              ]}
            />
            <Switch
              size="sm"
              label="Auto-advance"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.currentTarget.checked)}
            />
            <Switch
              size="sm"
              label="Number pad"
              checked={numberPad}
              onChange={(e) => setNumberPad(e.currentTarget.checked)}
            />
          </Group>
          <Group gap="sm">
            <Button
              variant="default"
              color="red"
              leftSection={<IconEraser size={16} />}
              disabled={locked || entered === 0}
              onClick={confirmClear}
            >
              Clear marks
            </Button>
            <Button
              variant={locked ? 'light' : 'filled'}
              color={locked ? 'gray' : 'green'}
              leftSection={locked ? <IconLockOpen size={16} /> : <IconLock size={16} />}
              onClick={toggleLock}
            >
              {locked ? 'Unlock' : 'Mark final'}
            </Button>
          </Group>
        </Group>
      </Paper>

      <Group justify="space-between" align="flex-end">
        <SegmentPicker
          value={segment.id}
          onChange={setSegmentId}
          segments={segments.map((s) => {
            const r = result.segments.find((x) => x.segmentId === s.id)!;
            const total = s.markKeys.length * judges.length * entries.length;
            return {
              id: s.id,
              name: s.name,
              progress: total ? (total - r.missingMarks) / total : 0,
              complete: r.complete,
            };
          })}
        />
        {locked && (
          <Badge color="green" leftSection={<IconLock size={12} />}>
            Final — read only
          </Badge>
        )}
      </Group>

      {/* The mark grid's card fits its columns, scrolling once it runs out of room. */}
      <Group wrap="nowrap" align="flex-start" justify="space-between" gap="md">
        <Box w="fit-content" maw="100%" miw={0}>
          <Card withBorder p="sm">
            <MarkGrid
              focusKey={`${event.id}:${segment.id}`}
              rows={rows}
              entryLabel={entryHeading[event.entryType]}
              judges={judges}
              markKeys={segment.markKeys}
              getValue={(k, j, e) => markMap.get(markKey(k, j, e))}
              onCommit={(segmentKey, judgeId, entryId, tenths) => {
                void setMark({ eventId: event.id, segmentKey, judgeId, entryId }, tenths);
                if (event.status === 'setup' || event.status === 'ready')
                  void setEventStatus(event.id, 'scoring');
              }}
              ordinals={ordinals}
              direction={direction}
              autoAdvance={autoAdvance}
              readOnly={locked}
              numberPad={numberPad}
              focusedInputRef={focusedInput}
            />
            {/* Wraps to the grid's width rather than widening the page to fit on one line. */}
            <Text size="xs" c="dimmed" mt="sm" style={{ contain: 'inline-size' }}>
              Type <Kbd>57</Kbd> for 5.7, <Kbd>100</Kbd> for 10.0, <Kbd>5</Kbd> <Kbd>Enter</Kbd> for 5.0.{' '}
              <Kbd>Enter</Kbd>/<Kbd>Tab</Kbd> next · <Kbd>Shift</Kbd> back · arrows move · <Kbd>Esc</Kbd> undo
              edit · empty + <Kbd>Enter</Kbd> keeps the value; delete the text to clear a mark.
            </Text>
          </Card>
        </Box>
        {numberPad && <NumberPad targetRef={focusedInput} disabled={locked} />}
      </Group>
    </Stack>
  );
}
