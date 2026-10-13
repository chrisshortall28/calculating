import { Alert, Box, Card, Group, Stack, Text } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useJudges, useSkaters } from '../../app/data';
import { clearMarks, setEventStatus, setMark } from '../../db/repo';
import { byId, entryClub, entryHeading, entryName } from '../../domain/entryName';
import { eventTieBreakMarks, segmentNoun } from '../../domain/segments';
import type { CompEvent, SegmentKey } from '../../domain/types';
import { judgeEventRanks } from '../../scoring';
import type { Direction } from '../../marks/gridNav';
import { JudgeGrid } from '../../marks/JudgeGrid';
import { MarkGrid } from '../../marks/MarkGrid';
import { NumberPad } from '../../marks/NumberPad';
import { ScoringToolbar } from './ScoringToolbar';
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
  const [view, setView] = useLocalStorage<'dance' | 'judge'>({
    key: 'podium.scoringView',
    defaultValue: 'dance',
  });
  const [judgeSel, setJudgeSel] = useState<string | null>(null);

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

  const byJudge = view === 'judge';
  const judgeId = judgeSel && event.judgeIds.includes(judgeSel) ? judgeSel : event.judgeIds[0];
  const judgeNo = judgeId ? event.judgeIds.indexOf(judgeId) + 1 : 0;

  // The selected judge's sheet: each entry's event total once all their marks are in, and the
  // judge's ranking once every mark is in.
  const sheet = useMemo(() => {
    if (!judgeId) return undefined;
    const mark = (k: SegmentKey, j: string, e: string) => markMap.get(markKey(k, j, e));
    const entryIds = entries.map((e) => e.id);
    const { sums, ranks } = judgeEventRanks(segments, judgeId, entryIds, mark, eventTieBreakMarks(event));
    const full = (e: string) =>
      segments.every((s) => s.markKeys.every((k) => mark(k, judgeId, e) !== undefined));
    return {
      sums: new Map([...sums].filter(([e]) => full(e))),
      ranks: entryIds.every(full) ? ranks : undefined,
    };
  }, [judgeId, segments, entries, markMap, event]);

  // The tabs start after the grid's # and entry columns.
  const gridBox = useRef<HTMLDivElement>(null);
  const [tabOffset, setTabOffset] = useState(0);
  useLayoutEffect(() => {
    const box = gridBox.current;
    const th = box?.querySelectorAll('thead tr:first-child th')[1];
    if (!box || !th) return;
    const offset = Math.round(th.getBoundingClientRect().right - box.getBoundingClientRect().left);
    if (offset !== tabOffset) setTabOffset(offset);
  });

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
    <Stack style={fitWidth} gap={28}>
      <ScoringToolbar
        noun={segmentNoun(event)}
        view={view}
        onView={setView}
        direction={direction}
        onDirection={setDirection}
        autoAdvance={autoAdvance}
        onAutoAdvance={setAutoAdvance}
        numberPad={numberPad}
        onNumberPad={setNumberPad}
        locked={locked}
        canClear={entered > 0}
        onClear={confirmClear}
        onToggleLock={toggleLock}
      />

      {/* The mark grid's card fits its columns, scrolling once it runs out of room. */}
      <Group wrap="nowrap" align="flex-start" justify="space-between" gap="md">
        <Box ref={gridBox} w="fit-content" maw="100%" miw={0}>
          <div style={{ paddingLeft: tabOffset }}>
            {byJudge ? (
              <SegmentPicker
                value={judgeId ?? ''}
                onChange={setJudgeSel}
                segments={judges.map((j, i) => {
                  const total = segments.reduce((n, s) => n + s.markKeys.length, 0) * entries.length;
                  let missing = 0;
                  for (const s of segments)
                    for (const k of s.markKeys)
                      for (const e of entries) if (!markMap.has(markKey(k, j.id, e.id))) missing++;
                  return {
                    id: j.id,
                    name: `J${i + 1} ${j.name}`,
                    done: total - missing,
                    total,
                    complete: total > 0 && missing === 0,
                  };
                })}
              />
            ) : (
              <SegmentPicker
                value={segment.id}
                onChange={setSegmentId}
                segments={segments.map((s) => {
                  const r = result.segments.find((x) => x.segmentId === s.id)!;
                  const total = s.markKeys.length * judges.length * entries.length;
                  return {
                    id: s.id,
                    name: s.name,
                    done: total - r.missingMarks,
                    total,
                    complete: r.complete,
                  };
                })}
              />
            )}
          </div>
          <Card withBorder p="sm" radius="md">
            {byJudge && judgeId ? (
              <JudgeGrid
                focusKey={`${event.id}:${judgeId}`}
                rows={rows}
                entryLabel={entryHeading[event.entryType]}
                judgeId={judgeId}
                judgeNo={judgeNo}
                segments={segments}
                getValue={(k, j, e) => markMap.get(markKey(k, j, e))}
                onCommit={(segmentKey, jId, entryId, tenths) => {
                  void setMark({ eventId: event.id, segmentKey, judgeId: jId, entryId }, tenths);
                  if (event.status === 'setup' || event.status === 'ready')
                    void setEventStatus(event.id, 'scoring');
                }}
                sums={sheet?.sums ?? new Map()}
                ranks={sheet?.ranks}
                direction={direction}
                autoAdvance={autoAdvance}
                readOnly={locked}
                numberPad={numberPad}
                focusedInputRef={focusedInput}
              />
            ) : byJudge ? (
              <Text c="dimmed">Add judges to this event’s panel to start entering marks.</Text>
            ) : (
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
            )}
          </Card>
        </Box>
        {numberPad && <NumberPad targetRef={focusedInput} disabled={locked} />}
      </Group>
    </Stack>
  );
}
