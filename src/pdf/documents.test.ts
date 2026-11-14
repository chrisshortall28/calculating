import { describe, expect, it } from 'vitest';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { defaultFactors, eventSegments, eventTieBreakMarks } from '../domain/segments';
import type { CompEvent, SegmentKey } from '../domain/types';
import { calculateEvent } from '../scoring';
import { judgeSheets, judgeSheetsDocument, officialsLine, resultsDocument, resultsPages } from './documents';
import type { EventData } from './loadEvent';
import { sampleEvent } from './testEvent';

/** All text in a pdfmake content tree, flattened. */
function texts(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (node && typeof node === 'object') return Object.values(node).flatMap(texts);
  return [];
}

describe('resultsPages', () => {
  it('standard results include points, majority victories, the rule and judge rankings, in that order', () => {
    const t = texts(resultsPages([sampleEvent()], 'standard'));
    expect(t).toEqual(expect.arrayContaining(['Referee', 'Kate', '15.0']));
    expect(t.filter((s) => s.startsWith('Event'))).toEqual(['Event']); // the title, with no "— Results"
    const order = ['Place', 'Skater', 'Club', 'Points', 'Majority victories', 'Rule', 'J1', 'J2', 'J3'];
    const at = order.map((h) => t.indexOf(h));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('heads the entry column by entry type, on results and judges’ sheets', () => {
    for (const [entryType, heading] of [
      ['solo', 'Skater'],
      ['duo', 'Skaters'],
      ['couples', 'Skaters'],
      ['team', 'Team'],
    ] as const) {
      const d = sampleEvent();
      const ev = { ...d, event: { ...d.event, entryType } };
      for (const t of [texts(resultsPages([ev], 'withMarks')), texts(judgeSheets([ev]))]) {
        expect(t).toContain(heading);
        expect(t).not.toContain('Entry');
      }
    }
  });

  it('lists the judges and referee under the results table, in every style', () => {
    for (const style of ['standard', 'withMarks', 'guest'] as const) {
      const t = texts(resultsPages([sampleEvent()], style));
      expect(t.indexOf('Judges')).toBeGreaterThan(t.indexOf('Beth')); // Beth is the table's last row
      expect(t.indexOf('Referee')).toBeGreaterThan(t.indexOf('Judges'));
    }
  });

  it('standard and guest results share pages but keep each event whole; with-marks gets a page each', () => {
    const events = [sampleEvent(), sampleEvent()];
    for (const style of ['standard', 'guest'] as const) {
      for (const block of resultsPages(events, style)) {
        expect(block).toMatchObject({ unbreakable: true });
        expect(block).not.toHaveProperty('pageBreak');
      }
    }
    expect(resultsPages(events, 'withMarks')[1]).toMatchObject({ pageBreak: 'before' });
  });

  it('shows the competition once per page when events share pages', () => {
    const events = [sampleEvent(), sampleEvent()];
    const shared = resultsDocument(events, 'standard');
    expect(texts(shared.content)).not.toContain('Comp');
    expect(shared.header).toMatchObject({ text: 'Comp' });
    const perEvent = resultsDocument(events, 'withMarks');
    expect(texts(perEvent.content).filter((t) => t === 'Comp')).toHaveLength(2);
    expect(perEvent.header).toBeUndefined();
  });

  it('shows the rule that resolved a tie, with a key, in the standard and with-marks styles', () => {
    const d = sampleEvent();
    const mark = () => 50; // every mark equal: a tie that no rule splits
    const tied = {
      ...d,
      mark,
      result: calculateEvent({
        entryIds: ['e0', 'e1'],
        judgeIds: d.judges.map((j) => j.id),
        segments: d.segments,
        mark,
        tieBreakMarks: [],
      }),
    };
    for (const style of ['standard', 'withMarks'] as const) {
      const t = texts(resultsPages([tied], style));
      expect(t).toEqual(expect.arrayContaining(['Rule', '8', '1=', 'CIPA tie-break rules: 8 tie']));
    }
    const guest = texts(resultsPages([tied], 'guest'));
    expect(guest).toContain('1=');
    expect(guest).not.toContain('Rule');
    expect(guest).not.toContain('8');
    expect(guest).not.toContain('CIPA tie-break rules: 8 tie');
    const detail = texts(resultsPages([tied], 'withMarks'));
    expect(detail).toEqual(expect.arrayContaining(['How ties were resolved', 'Table of Victories']));
    expect(texts(resultsPages([sampleEvent()], 'standard'))).not.toContain('CIPA tie-break rules: 8 tie');
  });

  it('guest-judge results show placings and officials only', () => {
    const t = texts(resultsPages([sampleEvent()], 'guest'));
    expect(t).toEqual(
      expect.arrayContaining(['Place', 'Skater', 'Club', 'Amy', 'Judges', 'Referee', 'Kate']),
    );
    expect(t).not.toContain('Majority victories');
    expect(t).not.toContain('Points');
    expect(t).not.toContain('J1');
    expect(t).not.toContain('15.0'); // Amy's total points (3 judges × 5.0)
  });
});

describe('judgeSheets', () => {
  const withDances = (count: number): EventData => {
    const segments = Array.from({ length: count }, (_, i) => ({
      id: `cd:${i}`,
      name: `Dance ${i + 1}`,
      kind: 'compulsory' as const,
      markKeys: [`cd:${i}` as SegmentKey],
    }));
    return { ...sampleEvent(), segments };
  };

  it('marks who skates first in each rotating dance, in that dance’s Comments box', () => {
    const d = {
      ...withDances(2),
      firstSkaters: new Map([
        ['cd:0', 0],
        ['cd:1', 1],
      ]),
    };
    // 3 judges + the referee, each with one sheet; Amy skates the first dance first, Beth the second.
    expect(texts(judgeSheets([d])).filter((t) => t === 'Skates First')).toHaveLength(8);
    expect(texts(judgeSheets([withDances(2)]))).not.toContain('Skates First');
  });

  it('lists the skaters of a per-dance sheet from that dance’s first skater, keeping start numbers', () => {
    const d = {
      ...withDances(2),
      firstSkaters: new Map([
        ['cd:0', 0],
        ['cd:1', 1],
      ]),
    };
    const [dance1, dance2] = judgeSheets([d], { layout: 'perPart' }) as unknown[];
    const order = (page: unknown) => texts(page).filter((t) => ['Amy', 'Beth'].includes(t.split(' ')[0]!));
    const names = d.rows.map((r) => r.name);
    expect(order(dance1)).toEqual(names);
    expect(order(dance2)).toEqual([...names].reverse());
    // The start numbers travel with the skaters: 2 then 1.
    expect(texts(dance2).filter((t) => t === '1' || t === '2')).toEqual(['2', '1']);
  });

  it('prints a sheet per dance, without totals, when asked', () => {
    const d = withDances(3);
    const pages = judgeSheets([d], { layout: 'perPart' });
    expect(pages).toHaveLength(3 * 4); // 3 dances x (3 judges + referee)
    const t = texts(pages);
    expect(t).toEqual(
      expect.arrayContaining(['Event — Dance 1 (Dance 1 of 3)', 'Event — Dance 3 (Dance 3 of 3)']),
    );
    expect(t).not.toContain('Total points');
    expect(texts(judgeSheets([d]))).toContain('Total points');
  });

  it('prints just the free dance, without totals, when asked', () => {
    const d = {
      ...withDances(2),
      segments: [
        ...withDances(2).segments,
        { id: 'fd', name: 'Free Dance', kind: 'free' as const, markKeys: ['fd:A', 'fd:B'] as SegmentKey[] },
      ],
    };
    const only = { layout: 'perPart' as const, segmentIds: new Set(['fd']) };
    const pages = judgeSheets([d], only);
    expect(pages).toHaveLength(4); // one sheet each for 3 judges + the referee
    const t = texts(pages[0]);
    expect(t).toEqual(expect.arrayContaining(['Event — Free Dance', 'A', 'B']));
    expect(t).not.toContain('Dance 1');
    expect(t).not.toContain('Total points');
    expect(judgeSheets([withDances(2)], only)).toHaveLength(0);
  });

  it('prints chosen parts only, numbered within the whole event, and without totals on a combined sheet', () => {
    const d = withDances(3);
    const pick = new Set(['cd:1', 'cd:2']);
    const perPart = texts(judgeSheets([d], { layout: 'perPart', segmentIds: pick }));
    expect(perPart).toEqual(
      expect.arrayContaining(['Event — Dance 2 (Dance 2 of 3)', 'Event — Dance 3 (Dance 3 of 3)']),
    );
    expect(perPart).not.toContain('Event — Dance 1 (Dance 1 of 3)');
    const combined = judgeSheets([d], { segmentIds: pick });
    expect(combined).toHaveLength(4); // one sheet each for 3 judges + the referee
    const t = texts(combined);
    expect(t).toEqual(expect.arrayContaining(['Dance 2', 'Dance 3']));
    expect(t).not.toContain('Dance 1');
    expect(t).not.toContain('Total points');
    expect(texts(judgeSheets([d]))).toContain('Total points');
  });

  describe('a long entry list on per-dance sheets', () => {
    const withEntries = (count: number): EventData => ({
      ...withDances(1),
      rows: Array.from({ length: count }, (_, i) => ({
        id: `e${i}`,
        name: `Skater ${i + 1}`,
        club: 'Club',
        members: '',
        skaterIds: [],
      })),
    });
    const tables = (node: unknown): { body: unknown[] }[] => {
      if (Array.isArray(node)) return node.flatMap(tables);
      if (node && typeof node === 'object') {
        const o = node as { table?: { body: unknown[] } };
        return [...(o.table ? [o.table] : []), ...Object.values(node).flatMap(tables)];
      }
      return [];
    };

    it('keeps up to 12 entries in a single table', () => {
      const pages = judgeSheets([withEntries(12)], { layout: 'perPart' });
      expect(pages).toHaveLength(4);
      expect(tables(pages[0])).toHaveLength(1);
    });

    it('puts the overflow in a second column on the same sheet', () => {
      const pages = judgeSheets([withEntries(15)], { layout: 'perPart' });
      expect(pages).toHaveLength(4); // one sheet each for 3 judges + the referee
      const [left, right] = tables(pages[0]);
      expect(left!.body).toHaveLength(2 + 12); // two header rows
      expect(right!.body).toHaveLength(2 + 3);
      expect(texts(right).filter((t) => /^\d+$/.test(t))).toEqual(['13', '14', '15']);
    });

    it('carries on to another sheet after 24 entries', () => {
      const pages = judgeSheets([withEntries(25)], { layout: 'perPart' });
      expect(pages).toHaveLength(8);
      expect(texts(pages[0])).toContain('Event — Dance 1 (Dance 1 of 1) · Sheet 1 of 2');
      expect(texts(tables(pages[1])).filter((t) => /^\d+$/.test(t))).toEqual(['25']);
    });

    it('leaves a sheet with several dances as it is', () => {
      const d = { ...withEntries(15), ...{ segments: withDances(2).segments } };
      const pages = judgeSheets([d]);
      expect(pages).toHaveLength(4);
      expect(tables(pages[0])).toHaveLength(1);
    });
  });

  it('fits up to four dances on one sheet per official', () => {
    const pages = judgeSheets([withDances(4)]);
    expect(pages).toHaveLength(4); // 3 judges + referee
    const t = texts(pages[0]);
    expect(t).toEqual(expect.arrayContaining(['Dance 1', 'Dance 4', 'Total points', 'Place']));
    expect(t).not.toContain('Event — Sheet 1 of 2');
  });

  it('shares more dances evenly across sheets, with the totals on the last', () => {
    const pages = judgeSheets([withDances(5)]);
    expect(pages).toHaveLength(8); // 2 sheets each for 3 judges + referee
    const first = texts(pages[0]);
    const second = texts(pages[1]);
    expect(first).toEqual(expect.arrayContaining(['Event — Sheet 1 of 2', 'Dance 1', 'Dance 3']));
    expect(first).not.toContain('Dance 4');
    expect(first).not.toContain('Total points');
    expect(second).toEqual(
      expect.arrayContaining(['Event — Sheet 2 of 2', 'Dance 4', 'Dance 5', 'Total points', 'Place']),
    );
  });

  it('names the event and official once, above the table, and has no page numbers', () => {
    const doc = judgeSheetsDocument([sampleEvent()]);
    const t = texts((doc.content as unknown[])[0]); // J1's sheet
    expect(t.filter((s) => s.includes('Event'))).toEqual(['Event']);
    expect(t.filter((s) => s.includes('Helen'))).toEqual([]);
    expect(t.filter((s) => s.includes('J1'))).toEqual(['J1  ______________________________']);
    const footer = (d: TDocumentDefinitions) =>
      (d.footer as (page: number, pages: number) => { text: string })(1, 2).text;
    expect(footer(doc)).toBe('Created with Podium');
    expect(footer(resultsDocument([sampleEvent()], 'standard'))).toBe('Created with Podium · page 1 of 2');
  });

  it('keeps the table of victories whole, on a new page only for a single event with marks', () => {
    const victories = (single: boolean) => {
      let found: Record<string, unknown> | undefined;
      JSON.stringify(resultsDocument([sampleEvent()], 'withMarks', single).content, (_k, v) => {
        if (v?.stack?.[0]?.text === 'Table of Victories') found = v;
        return v;
      });
      return found!;
    };
    expect(victories(true)).toMatchObject({ unbreakable: true, pageBreak: 'before' });
    expect(victories(false)).toMatchObject({ unbreakable: true });
    expect(victories(false).pageBreak).toBeUndefined();
  });

  it('prints results portrait unless with marks or for a single event (stapled to its judge sheets)', () => {
    expect(resultsDocument([sampleEvent()], 'standard').pageOrientation).toBe('portrait');
    expect(resultsDocument([sampleEvent()], 'standard', true).pageOrientation).toBe('landscape');
    expect(resultsDocument([sampleEvent()], 'guest').pageOrientation).toBe('portrait');
    // With marks is always landscape, for the table of victories.
    expect(resultsDocument([sampleEvent()], 'withMarks').pageOrientation).toBe('landscape');
    expect(resultsDocument([sampleEvent()], 'withMarks', true).pageOrientation).toBe('landscape');
    expect(judgeSheetsDocument([sampleEvent()]).pageOrientation).toBe('landscape');
  });
});

describe('figures & free events', () => {
  /** Two pairs entries level on everything but the programme B marks, so rule 7B decides. */
  function figuresEvent(figures: CompEvent['figures']): EventData {
    const d = sampleEvent();
    const event: CompEvent = {
      ...d.event,
      entryType: 'pairs',
      compulsoryDanceIds: [],
      discipline: 'figures',
      figures,
      hasShort: true,
      hasLong: true,
      factors: defaultFactors(figures.length, true, true),
    };
    const segments = eventSegments(event, []);
    // j0 favours e0 on the short programme A mark; j1 favours e1; the free B totals are equal and
    // the short B totals favour e1.
    const mark = (k: SegmentKey, j: string, e: string) =>
      k === 'sp:A'
        ? j === 'j0' && e === 'e0'
          ? 60
          : 50
        : k === 'sp:B'
          ? j === 'j1' && e === 'e1'
            ? 60
            : 50
          : 50;
    const judgeIds = ['j0', 'j1'];
    return {
      ...d,
      event: { ...event, judgeIds },
      judges: d.judges.slice(0, 2),
      segments,
      mark,
      result: calculateEvent({
        entryIds: ['e0', 'e1'],
        judgeIds,
        segments,
        mark,
        tieBreakMarks: eventTieBreakMarks(event),
      }),
    };
  }

  it('shows the parts, the 7B rule key and the factors', () => {
    const t = texts(resultsPages([figuresEvent([])], 'withMarks'));
    expect(t).toEqual(
      expect.arrayContaining([
        'Short Programme',
        'Free Programme',
        'CIPA tie-break rules: 7B free programme, then short programme B marks',
        'Each judge’s sum multiplies each part’s marks by its factor: short programme ×1, free programme ×3.',
        '7B Short programme B marks: Amy 10.0, Beth 11.0 — Beth takes 1st.',
        'S.M.V.',
        'Total B scores',
        '10.0 / 10.0',
        '10.0 / 11.0',
      ]),
    );
  });

  it('with figures, equal programme B marks do not decide, and judge sheets list the figures', () => {
    const d = figuresEvent([{ figureId: '8', side: 'L' }]);
    expect(d.result.overall.map((o) => o.rule)).toEqual(['8', '8']);
    expect(texts(judgeSheets([d]))).toEqual(
      expect.arrayContaining(['8. Threes FO - BI (Left)', 'Short Programme', 'A', 'B']),
    );
  });
});

describe('officialsLine with different judges for some parts', () => {
  it('names the seat’s own judge and who sits in it for which part', () => {
    const d = sampleEvent();
    const line = officialsLine({
      judges: d.judges,
      referee: d.referee,
      swaps: [{ seat: 2, segmentName: 'Free Dance', judge: { id: 'x', name: 'Dora' } }],
    });
    expect(line).toBe('Judges: J1 Helen, J2 Ian (Dora in Free Dance), J3 Jo · Referee: Kate');
    expect(officialsLine({ judges: d.judges, referee: d.referee })).toBe(
      'Judges: J1 Helen, J2 Ian, J3 Jo · Referee: Kate',
    );
  });
});

describe('officialsLine with an assistant referee', () => {
  it('names the assistant referee after the referee, only when there is one', () => {
    const d = sampleEvent();
    const assistantReferee = { id: 'a', competitionId: 'c', name: 'Ann' };
    expect(officialsLine({ judges: d.judges, referee: d.referee, assistantReferee })).toBe(
      'Judges: J1 Helen, J2 Ian, J3 Jo · Referee: Kate · Assistant referee: Ann',
    );
    expect(texts(resultsPages([{ ...d, assistantReferee }], 'standard', true))).toEqual(
      expect.arrayContaining(['Assistant referee', 'Ann']),
    );
    expect(texts(resultsPages([d], 'standard', true))).not.toContain('Assistant referee');
  });
});
