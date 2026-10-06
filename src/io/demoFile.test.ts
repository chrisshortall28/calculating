import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventSegments, eventTieBreakMarks } from '../domain/segments';
import { calculateEvent } from '../scoring';
import { parseCompetitionFile } from './competitionFile';

const file = parseCompetitionFile(JSON.parse(readFileSync('examples/podium-demo.pod', 'utf8')));

function score(eventName: string) {
  const event = file.events.find((e) => e.name === eventName)!;
  const marks = new Map(
    file.marks
      .filter((m) => m.eventId === event.id)
      .map((m) => [`${m.segmentKey}|${m.judgeId}|${m.entryId}`, m.tenths]),
  );
  return calculateEvent({
    entryIds: file.entries.filter((e) => e.eventId === event.id).map((e) => e.id),
    judgeIds: event.judgeIds,
    segments: eventSegments(event, file.dances),
    mark: (k, j, e) => marks.get(`${k}|${j}|${e}`),
    tieBreakMarks: eventTieBreakMarks(event),
  });
}

/** The tie-break rules used to place the entries, e.g. "6B" or "7B" (rule 5 is no tie). */
const tieRules = (name: string) =>
  [...new Set(score(name).steps.map((s) => s.rule))].filter((r) => r !== '5');

describe('examples/podium-demo.pod', () => {
  it('has every event fully marked', () => {
    for (const e of file.events) expect(score(e.name).complete, e.name).toBe(true);
  });

  it.each([
    ['Juvenile Girls Solo Dance', []],
    ['Junior Couples Dance', []],
    ['Open Team Dance', []],
    ['Novice Ladies Figures & Free', []],
    ['Senior Pairs Figures & Free', []],
    ['Junior Men Solo Dance', ['6B']],
    ['Junior Men Figures & Free', ['6B']],
    ['Junior Ladies Solo Dance', ['6A']],
    ['Senior Ladies Solo Dance', ['7B']],
    ['Junior Pairs Short & Free Programme', ['7B']],
    ['Senior Ladies Short & Free Programme', ['7B']],
    ['Senior Men Solo Dance', ['7C']],
    ['Youth Ladies Solo Dance', ['7A']],
    ['Adult Solo Dance', ['8']],
  ])('%s is placed by rules %j', (name, rules) => {
    expect(tieRules(name)).toEqual(rules);
  });

  it('shows rule 3: a judge’s equal sums split by the free dance B mark, or a half victory each', () => {
    expect(score('Novice Boys Solo Dance').judgeTies.some((t) => t.winner)).toBe(true);
    expect(score('Intermediate Ladies Solo Dance').judgeTies.some((t) => !t.winner)).toBe(true);
  });

  it('breaks a tie on the short programme B mark when the free programme B marks are level (second 7B)', () => {
    const second = score('Senior Ladies Short & Free Programme').steps.filter(
      (s) => s.rule === '7B' && s.trail.filter((a) => a.rule === '7B').length === 2,
    );
    expect(second.length).toBeGreaterThan(0);
  });

  it('shares a place under rule 8', () => {
    expect(score('Adult Solo Dance').overall.filter((o) => o.tied)).toHaveLength(2);
  });
});
