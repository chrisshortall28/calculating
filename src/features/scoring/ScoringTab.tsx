import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Kbd,
  Progress,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconCheck, IconEraser, IconLock, IconLockOpen } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useJudges, useSkaters } from '../../app/data';
import { clearMarks, setEventStatus, setMark } from '../../db/repo';
import { byId, entryClub, entryName } from '../../domain/entryName';
import type { CompEvent } from '../../domain/types';
import type { Direction } from '../../marks/gridNav';
import { MarkGrid } from '../../marks/MarkGrid';
import { ProvisionalPanel } from './ProvisionalPanel';
import { markKey, useEventResult } from './useEventResult';

/** More dances than this switch with a dropdown rather than side-by-side tabs. */
const MAX_TABBED_DANCES = 5;
const checkIcon = <IconCheck size={14} color="var(--mantine-color-green-6)" />;

export function ScoringTab({ event }: { event: CompEvent }) {
  const { loading, segments, entries, markMap, result, standing, standingAfter } = useEventResult(event);
  const skaters = byId(useSkaters(event.competitionId));
  const judgeMap = byId(useJudges(event.competitionId));
  const [direction, setDirection] = useLocalStorage<Direction>({
    key: 'podium.direction',
    defaultValue: 'down',
  });
  const [autoAdvance, setAutoAdvance] = useLocalStorage({ key: 'podium.autoAdvance', defaultValue: true });
  const [segmentId, setSegmentId] = useState<string | null>(null);

  // Open on the first incomplete dance, then stay put: finishing a dance shouldn't switch the grid away.
  const firstIncomplete = result.segments.find((s) => !s.complete)?.segmentId;
  const initialId = firstIncomplete ?? segments[0]?.id;
  if (segmentId === null && !loading && initialId) setSegmentId(initialId);
  const activeId = segmentId ?? initialId;
  const segment = segments.find((s) => s.id === activeId) ?? segments[0];
  const segResult = result.segments.find((s) => s.segmentId === segment?.id);
  const isComplete = (id: string) => result.segments.find((s) => s.segmentId === id)?.complete;
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
      <Alert color="orange">This event has no dances. Add compulsory dances or a free dance in Setup.</Alert>
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
    <Stack>
      <Group justify="space-between" align="flex-end">
        {segments.length > MAX_TABBED_DANCES ? (
          // Too many dances to sit side by side: pick from a list instead.
          <Select
            w={260}
            value={segment.id}
            onChange={(v) => v && setSegmentId(v)}
            allowDeselect={false}
            leftSection={isComplete(segment.id) ? checkIcon : undefined}
            data={segments.map((s) => ({ value: s.id, label: s.name }))}
            renderOption={({ option }) => (
              <Group gap={6} wrap="nowrap">
                {isComplete(option.value) ? checkIcon : <Box w={14} />}
                {option.label}
              </Group>
            )}
          />
        ) : (
          <SegmentedControl
            value={segment.id}
            onChange={setSegmentId}
            data={segments.map((s) => ({
              value: s.id,
              label: (
                <Group gap={6} wrap="nowrap">
                  {isComplete(s.id) && checkIcon}
                  {s.name}
                </Group>
              ),
            }))}
          />
        )}
        <Group>
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

      <Group gap="sm">
        <Progress
          value={result.totalMarks ? (100 * entered) / result.totalMarks : 0}
          w={200}
          color={result.complete ? 'green' : 'blue'}
        />
        <Text size="sm" c="dimmed">
          {entered} / {result.totalMarks} marks
        </Text>
        {segResult && !segResult.complete && segResult.missingMarks > 0 && (
          <Badge color="yellow" variant="light">
            {segResult.missingMarks} missing in {segment.name}
          </Badge>
        )}
        {locked && (
          <Badge color="green" leftSection={<IconLock size={12} />}>
            Final — read only
          </Badge>
        )}
      </Group>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card withBorder p="sm">
            <MarkGrid
              focusKey={`${event.id}:${segment.id}`}
              rows={rows}
              judges={judges}
              markKeys={segment.markKeys}
              getValue={(k, j, e) => markMap.get(markKey(k, j, e))}
              onCommit={(segmentKey, judgeId, entryId, tenths) => {
                void setMark({ eventId: event.id, segmentKey, judgeId, entryId }, tenths);
                if (event.status === 'setup') void setEventStatus(event.id, 'scoring');
              }}
              ordinals={ordinals}
              direction={direction}
              autoAdvance={autoAdvance}
              readOnly={locked}
            />
            <Text size="xs" c="dimmed" mt="sm">
              Type <Kbd>57</Kbd> for 5.7, <Kbd>100</Kbd> for 10.0, <Kbd>5</Kbd> <Kbd>Enter</Kbd> for 5.0.{' '}
              <Kbd>Enter</Kbd>/<Kbd>Tab</Kbd> next · <Kbd>Shift</Kbd> back · arrows move · <Kbd>Esc</Kbd> undo
              edit · empty + <Kbd>Enter</Kbd> keeps the value; delete the text to clear a mark.
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <ProvisionalPanel result={result} standing={standing} standingAfter={standingAfter} rows={rows} />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
