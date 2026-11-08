import { Alert, Box, Card, Group, Kbd, Stack, Text } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCompetition, useJudges, useSkaters } from '../../app/data';
import { clearMarks, setEventStatus, setMark } from '../../db/repo';
import { occupant, segmentIdOfKey, segmentPanel, seatMark } from '../../domain/panels';
import { byId, entryClub, entryHeading, entryName, entryNoun } from '../../domain/entryName';
import { eventTieBreakMarks, segmentNoun } from '../../domain/segments';
import { effectiveRotate, firstSkaters, rotateFrom } from '../../domain/startOrder';
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
  const competition = useCompetition(event.competitionId);
  const [direction, setDirection] = useLocalStorage<Direction>({
    key: 'podium.direction',
    defaultValue: 'across',
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

  // With a rotating start order, each dance or figure is skated from its own first skater: the by-dance grid
  // lists the skaters in that order (keeping their start numbers), and the by-judge grid, which shows every
  // dance at once, keeps the start order and tags who skates each one first.
  const firstIndexes = competition
    ? firstSkaters(segments, entries.length, effectiveRotate(event, competition))
    : new Map<string, number>();
  const firstEntryIds = new Map<string, string>();
  for (const [segId, index] of firstIndexes) if (entries[index]) firstEntryIds.set(segId, entries[index].id);
  const firstRowId = segment ? firstEntryIds.get(segment.id) : undefined;
  const firstIndex = segment ? (firstIndexes.get(segment.id) ?? 0) : 0;

  // Seats J1…Jn: who sits in each can differ from part to part, so the grid lists the part's own judges.
  const seatRaw = useMemo(
    () => seatMark(event, (k: SegmentKey, j: string, e: string) => markMap.get(markKey(k, j, e))),
    [event, markMap],
  );
  const judges = (segment ? segmentPanel(event, segment.id) : event.judgeIds).map((id) => ({
    id,
    name: judgeMap.get(id)?.name ?? '?',
  }));
  const rows = useMemo(
    () =>
      entries.map((e, i) => ({
        no: i + 1,
        id: e.id,
        label: entryName(e, skaters),
        sub: entryClub(e, skaters),
      })),
    [entries, skaters],
  );
  const segmentRows = useMemo(() => rotateFrom(rows, firstIndex), [rows, firstIndex]);

  // Only show a judge's ordinals once all their marks for this segment are in.
  const ordinals = useMemo(() => {
    if (!segment || !segResult) return undefined;
    const shown = new Map<string, Map<string, number>>();
    for (const seat of event.judgeIds) {
      const j = occupant(event, segment.id, seat);
      const complete = entries.every((e) => segment.markKeys.every((k) => markMap.has(markKey(k, j, e.id))));
      if (complete) shown.set(j, segResult.ordinals.get(seat)!);
    }
    return shown;
  }, [segment, segResult, event, entries, markMap]);

  const byJudge = view === 'judge';
  const judgeId = judgeSel && event.judgeIds.includes(judgeSel) ? judgeSel : event.judgeIds[0];
  const judgeNo = judgeId ? event.judgeIds.indexOf(judgeId) + 1 : 0;
  // Parts where someone else sits in the selected seat.
  const others = judgeId
    ? segments
        .filter((s) => occupant(event, s.id, judgeId) !== judgeId)
        .map((s) => `${judgeMap.get(occupant(event, s.id, judgeId))?.name ?? '?'} in ${s.name}`)
    : [];

  // The selected judge's sheet: each entry's event total once all their marks are in, and the
  // judge's ranking once every mark is in.
  const sheet = useMemo(() => {
    if (!judgeId) return undefined;
    const mark = seatRaw;
    const entryIds = entries.map((e) => e.id);
    const { sums, ranks } = judgeEventRanks(segments, judgeId, entryIds, mark, eventTieBreakMarks(event));
    const full = (e: string) =>
      segments.every((s) => s.markKeys.every((k) => mark(k, judgeId, e) !== undefined));
    return {
      sums: new Map([...sums].filter(([e]) => full(e))),
      ranks: entryIds.every(full) ? ranks : undefined,
    };
  }, [judgeId, segments, entries, seatRaw, event]);

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
        entryNoun={entryNoun[event.entryType][0]}
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
                segments={event.judgeIds.map((seatId, i) => {
                  const total = segments.reduce((n, s) => n + s.markKeys.length, 0) * entries.length;
                  let missing = 0;
                  for (const s of segments)
                    for (const k of s.markKeys)
                      for (const e of entries) if (seatRaw(k, seatId, e.id) === undefined) missing++;
                  return {
                    id: seatId,
                    // A seat that more than one judge sits in over the event has no single name to show.
                    name: `J${i + 1} ${
                      segments.some((s) => occupant(event, s.id, seatId) !== seatId)
                        ? 'Multiple Judges'
                        : (judgeMap.get(seatId)?.name ?? '?')
                    }`,
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
            {byJudge && judgeId && others.length > 0 && (
              <Text size="sm" c="dimmed" mb="xs">
                J{judgeNo}: {judgeMap.get(judgeId)?.name}, with {others.join(', ')}.
              </Text>
            )}
            {byJudge && judgeId ? (
              <JudgeGrid
                focusKey={`${event.id}:${judgeId}`}
                rows={rows}
                entryLabel={entryHeading[event.entryType]}
                judgeId={judgeId}
                judgeNo={judgeNo}
                segments={segments}
                getValue={seatRaw}
                onCommit={(segmentKey, seatId, entryId, tenths) => {
                  // A seat's marks belong to whoever sits in it for that part.
                  const judgeId = occupant(event, segmentIdOfKey(segmentKey), seatId);
                  void setMark({ eventId: event.id, segmentKey, judgeId, entryId }, tenths);
                  if (event.status === 'setup' || event.status === 'ready')
                    void setEventStatus(event.id, 'scoring');
                }}
                sums={sheet?.sums ?? new Map()}
                ranks={sheet?.ranks}
                firstEntryIds={firstEntryIds}
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
                rows={segmentRows}
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
                firstRowId={firstRowId}
                direction={direction}
                autoAdvance={autoAdvance}
                readOnly={locked}
                numberPad={numberPad}
                focusedInputRef={focusedInput}
              />
            )}
            {/* Wraps to the grid's width rather than widening the page to fit on one line. */}
            <Text size="xs" c="dimmed" mt="sm" style={{ contain: 'inline-size' }}>
              Type <Kbd>57</Kbd> for 5.7, <Kbd>10</Kbd> for 1.0, <Kbd>5</Kbd> <Kbd>Enter</Kbd> for 5.0; for
              10.0 turn off auto-advance and type <Kbd>100</Kbd>.
            </Text>
          </Card>
        </Box>
        {numberPad && <NumberPad targetRef={focusedInput} disabled={locked} />}
      </Group>
    </Stack>
  );
}
