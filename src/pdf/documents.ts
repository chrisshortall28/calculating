import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { clubColors, onColor } from '../app/clubColors';
import { entryHeading } from '../domain/entryName';
import { factorSummary, markKeyLabel } from '../domain/segments';
import { formatTenths } from '../marks/parseMark';
import {
  bTotalsUsed,
  explainJudgeTie,
  explainStep,
  formatRuleValue,
  formatSum,
  formatVictories,
  ordinalLabel,
  RULES,
  ruleLabel,
  type PlacementRule,
} from '../scoring';
import type { EventData } from './loadEvent';

const styles: TDocumentDefinitions['styles'] = {
  comp: { fontSize: 10, color: '#555' },
  title: { fontSize: 16, bold: true, margin: [0, 2, 0, 8] },
  h2: { fontSize: 12, bold: true, margin: [0, 10, 0, 4] },
  th: { bold: true, fontSize: 9, fillColor: '#eeeeee', alignment: 'center' },
  small: { fontSize: 8, color: '#555' },
};

/**
 * Results tables in the competition's colours: header cells filled with the primary colour (with
 * readable text on it) and ruled off in the secondary colour; light rules between rows.
 */
function clubTable(d: EventData) {
  const { primary, secondary } = clubColors(d.competition);
  return {
    th: (text: string, extra: Record<string, unknown> = {}): TableCell => ({
      text,
      style: 'th',
      fillColor: primary,
      color: onColor(primary),
      ...extra,
    }),
    layout: {
      hLineWidth: (i: number, node: { table: { headerRows?: number } }) =>
        i === 0 ? 0 : i === node.table.headerRows ? 2 : 0.5,
      hLineColor: (i: number, node: { table: { headerRows?: number } }) =>
        i === node.table.headerRows ? secondary : '#cccccc',
      vLineWidth: () => 0,
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  };
}

function compLine(d: EventData) {
  const c = d.competition;
  return [c.name, c.date && new Date(c.date).toLocaleDateString(), c.venue].filter(Boolean).join(' · ');
}

/** Competition line and event title; pages that share several events show the competition once, in the page header. */
function header(d: EventData, subtitle?: string, withCompetition = true): Content[] {
  return [
    ...(withCompetition ? [{ text: compLine(d), style: 'comp' }] : []),
    { text: d.event.name + (subtitle ? ` — ${subtitle}` : ''), style: 'title' },
  ];
}

// ---------------------------------------------------------------------------
// Judge sheets: one page per judge with empty boxes for handwritten marks.
// ---------------------------------------------------------------------------

interface Official {
  role: 'Judge' | 'Referee';
  label: string; // "J1"… for judges, "" for the referee
  name: string; // blank = name to be written in
}

/** Most dances one landscape sheet can hold while leaving the Comments columns room to write in. */
const DANCES_PER_SHEET = 4;

/** Splits the dances into as few sheets as fit, sharing them out evenly (5 dances → 3 + 2). */
function sheetParts<T>(segments: T[]): T[][] {
  const count = Math.ceil(segments.length / DANCES_PER_SHEET);
  const size = Math.ceil(segments.length / count);
  return Array.from({ length: count }, (_, i) => segments.slice(i * size, (i + 1) * size));
}

/** Landscape sheet: each dance gets a wide Comments column followed by its mark column(s) — Mark
 * for a compulsory dance, A and B for the free dance; Total points and Place sit on the far right.
 * An event with more dances than fit takes several sheets per official, with the totals on the last. */
function judgeSheetPage(
  d: EventData,
  { role, label, name }: Official,
  segments: EventData['segments'],
  part: { index: number; count: number },
): Content[] {
  const MARK_WIDTH = 38;
  const isLast = part.index === part.count - 1;
  const partLabel = part.count > 1 ? ` (${part.index + 1} of ${part.count})` : '';
  const columns = segments.map((s) => ({
    name: s.name,
    subs: [
      { label: 'Comments', width: '*' as const },
      ...s.markKeys.map((k) => ({ label: markKeyLabel(k) || 'Mark', width: MARK_WIDTH })),
    ],
  }));
  const subCols = columns.flatMap((c) => c.subs);

  const headRow1: TableCell[] = [
    { text: '#', style: 'th', rowSpan: 2 },
    { text: entryHeading[d.event.entryType], style: 'th', rowSpan: 2, alignment: 'left' },
    ...columns.flatMap((c) => {
      const cells: TableCell[] = [{ text: c.name, style: 'th', colSpan: c.subs.length }];
      for (let i = 1; i < c.subs.length; i++) cells.push({});
      return cells;
    }),
    ...(isLast
      ? [
          { text: 'Total points', style: 'th', rowSpan: 2 },
          { text: 'Place', style: 'th', rowSpan: 2 },
        ]
      : []),
  ];
  const headRow2: TableCell[] = [
    {},
    {},
    ...subCols.map((s) => ({ text: s.label, style: 'th' })),
    ...(isLast ? [{}, {}] : []),
  ];
  const body: TableCell[][] = [
    headRow1,
    headRow2,
    ...d.rows.map((r, i) => [
      {
        text: String(i + 1),
        alignment: 'center' as const,
        margin: [0, 9, 0, 9] as [number, number, number, number],
      },
      {
        stack: [
          { text: r.name, bold: true },
          { text: [r.club, r.members].filter(Boolean).join(' · '), style: 'small' },
        ],
      },
      ...subCols.map(() => ({ text: '' })),
      ...(isLast ? [{ text: '' }, { text: '' }] : []),
    ]),
  ];

  return [
    ...header(d, `${role}’s sheet${partLabel}`),
    {
      columns: [
        {
          text: [
            { text: `${role}: `, bold: true },
            [label, name || '______________________________'].filter(Boolean).join('  '),
          ],
        },
        {
          text: `Marks out of 10.0, one decimal place · ${d.rows.length} entries`,
          alignment: 'right',
          style: 'comp',
        },
      ],
      margin: [0, 0, 0, 8],
    },
    {
      table: {
        headerRows: 2,
        dontBreakRows: true,
        // The Comments columns share the spare width.
        widths: [18, 130, ...subCols.map((s) => s.width), ...(isLast ? [44, 34] : [])],
        body,
      },
    },
  ];
}

/**
 * One sheet per judge on the panel (or `blankCount` unnamed sheets if no judges are assigned
 * yet), followed by a sheet for the referee (unnamed if no referee is assigned yet).
 */
export function judgeSheets(events: EventData[], blankCount = 3): Content[] {
  const pages: Content[][] = [];
  for (const d of events) {
    if (d.segments.length === 0) continue;
    const officials: Official[] = d.judges.length
      ? d.judges.map((j, i) => ({ role: 'Judge', label: `J${i + 1}`, name: j.name }))
      : Array.from({ length: blankCount }, (_, i) => ({ role: 'Judge', label: `J${i + 1}`, name: '' }));
    officials.push({ role: 'Referee', label: '', name: d.referee?.name ?? '' });
    const parts = sheetParts(d.segments);
    for (const o of officials)
      parts.forEach((segments, index) =>
        pages.push(judgeSheetPage(d, o, segments, { index, count: parts.length })),
      );
  }
  return withPageBreaks(pages);
}

type Officials = Pick<EventData, 'judges' | 'referee'>;

const judgesText = (d: Officials) => d.judges.map((j, i) => `J${i + 1} ${j.name}`).join(', ') || '—';
const refereeText = (d: Officials) => d.referee?.name ?? '—';

/** "Judges: J1 A, J2 B, J3 C · Referee: D" (referee shown as "—" if not assigned) */
export function officialsLine(d: Officials): string {
  return `Judges: ${judgesText(d)} · Referee: ${refereeText(d)}`;
}

/** The event's officials as labelled lines, under the results table. */
function officialsBlock(d: Officials): Content {
  const row = (label: string, value: string) => [{ text: label, bold: true }, { text: value }];
  return {
    table: { widths: [52, '*'], body: [row('Judges', judgesText(d)), row('Referee', refereeText(d))] },
    layout: 'noBorders',
    margin: [0, 8, 0, 0],
  };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * - `standard`: placings with points (total sums), majority victories, the tie-break rule and each judge's ranking
 * - `withMarks`: standard plus the summary of scores and table of victories, how each tie was
 *   resolved, and every judge's marks for each dance
 * - `guest`: for events with guest judges — placings only, no scores or tie-break rules
 */
export type ResultsStyle = 'standard' | 'withMarks' | 'guest';

function resultsTable(d: EventData, placingsOnly: boolean): Content {
  const { result } = d;
  const name = new Map(d.rows.map((r) => [r.id, r]));
  const center = 'center' as const;
  const { th, layout } = clubTable(d);
  // Place, Entry, Club, then Points, Majority victories, Rule and each judge's ranking (the
  // guest style has none of those).
  const body: TableCell[][] = [
    [
      th('Place'),
      th(entryHeading[d.event.entryType], { alignment: 'left' }),
      th('Club', { alignment: 'left' }),
      ...(placingsOnly
        ? []
        : [th('Points'), th('Majority victories'), th('Rule'), ...d.judges.map((_, i) => th(`J${i + 1}`))]),
    ],
    ...result.overall.map((o) => {
      const r = name.get(o.entryId)!;
      return [
        { text: `${o.place}${o.tied ? '=' : ''}`, bold: true, alignment: center, fontSize: 12 },
        {
          stack: [{ text: r.name, bold: true }, ...(r.members ? [{ text: r.members, style: 'small' }] : [])],
        },
        r.club,
        ...(placingsOnly
          ? []
          : [
              { text: formatSum(o.totalSum), alignment: center },
              { text: formatVictories(o.majorityVictories), bold: true, alignment: center },
              { text: o.rule === '5' ? '' : ruleLabel(o.rule), alignment: center, color: '#555' },
              ...o.judgeRanks.map((rank) => ({ text: String(rank), alignment: center, color: '#555' })),
            ]),
      ];
    }),
  ];
  return {
    table: {
      headerRows: 1,
      widths: placingsOnly ? [34, '*', 180] : [34, '*', 90, 44, 52, 58, ...d.judges.map(() => 22)],
      body,
    },
    layout,
  };
}

/** Key to the rule numbers used in an event's Rule column, e.g. "Tie-break rules: 6B separate victories · 8 tie". */
function ruleKey(d: EventData): Content[] {
  const used = [...new Set(d.result.overall.map((o) => o.rule))].filter((r) => r !== '5');
  if (used.length === 0) return [];
  const order: PlacementRule[] = ['6A', '6B', '7B', '7C', '7A', '8'];
  used.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  // 7B names whose B marks: "free dance B marks", "long programme, then short programme B marks".
  const keyName = (r: PlacementRule) =>
    r === '7B'
      ? `${d.result.tieBreakMarks.map((t) => t.label).join(', then ')} B marks`
      : RULES[r].name.toLowerCase();
  return [
    {
      text: `CIPA tie-break rules: ${used.map((r) => `${ruleLabel(r)} ${keyName(r)}`).join(' · ')}`,
      style: 'small',
      margin: [0, 3, 0, 0],
    },
  ];
}

/** CIPA master chart: judges' sums, then each entry's judge victories over every other entry. */
function victoriesTable(d: EventData): Content[] {
  const { result } = d;
  const rowOf = new Map(result.overall.map((o) => [o.entryId, o]));
  const judgeCount = d.judges.length;
  const bTotals = bTotalsUsed(result.steps);
  const { th, layout } = clubTable(d);
  const center = 'center' as const;
  const head: TableCell[] = [
    th('#'),
    th(entryHeading[d.event.entryType], { alignment: 'left' }),
    ...d.judges.map((_, i) => th(`J${i + 1}`)),
    th('Total'),
    ...d.rows.map((_, i) => th(`v${i + 1}`)),
    th('MV'),
    th('Total B scores'),
    th('TV'),
    th('Pl'),
  ];
  const rows: TableCell[][] = d.rows.map((r, i) => {
    const o = rowOf.get(r.id)!;
    return [
      { text: String(i + 1), alignment: center, color: '#555' },
      r.name,
      ...o.judgeSums.map((s) => ({ text: formatSum(s), alignment: center })),
      { text: formatSum(o.totalSum), alignment: center, bold: true },
      ...d.rows.map((other) => {
        const v = result.victories.get(r.id)!.get(other.id);
        return v === undefined
          ? { text: '—', alignment: center, color: '#999' }
          : {
              text: formatVictories(v),
              alignment: center,
              bold: v * 2 > judgeCount,
              color: v * 2 > judgeCount ? '#000' : '#777',
            };
      }),
      { text: formatVictories(o.majorityVictories), alignment: center, bold: true },
      {
        text: (bTotals.get(r.id) ?? []).map((b) => formatRuleValue('7B', b.value)).join(' / '),
        alignment: center,
      },
      { text: formatVictories(o.totalVictories), alignment: center },
      { text: `${o.place}${o.tied ? '=' : ''}`, alignment: center, bold: true },
    ];
  });
  const factors = factorSummary(d.event);
  return [
    { text: 'Summary of scores and table of victories', style: 'h2' },
    ...(factors
      ? [
          {
            text: `Each judge’s sum multiplies each part’s marks by its factor: ${factors}.`,
            style: 'small',
            margin: [0, 0, 0, 3],
          } as Content,
        ]
      : []),
    {
      table: {
        headerRows: 1,
        widths: [12, '*', ...d.judges.map(() => 26), 30, ...d.rows.map(() => 16), 20, 42, 20, 18],
        body: [head, ...rows],
      },
      layout,
      fontSize: d.rows.length > 12 ? 6.5 : 8,
    } as Content,
    {
      text: `Judges’ sums, then each entry’s judge victories over every other (v1 = entry 1…). Bold: majority victory (${result.majority} of ${judgeCount} judges). MV majority victories · TV total victories.`,
      style: 'small',
      margin: [0, 3, 0, 0],
    },
  ];
}

/** How each tie on majority victories was resolved, and any equal sums from one judge (rule 3). */
function tieNotes(d: EventData): Content[] {
  const name = (id: string) => d.rows.find((r) => r.id === id)?.name ?? '?';
  const judge = (id: string) => `J${d.judges.findIndex((j) => j.id === id) + 1}`;
  const ties = d.result.steps.filter((s) => s.rule !== '5');
  const out: Content[] = [];
  if (ties.length)
    out.push(
      { text: 'How ties were resolved', style: 'h2' },
      ...ties.map((s) => ({
        stack: [
          {
            text: [
              {
                text: `${ordinalLabel(s.place)}${s.entryIds.length > 1 ? '=' : ''} ${s.entryIds.map(name).join(', ')}`,
                bold: true,
              },
              ` — rule ${ruleLabel(s.rule)}`,
            ],
            fontSize: 9,
          },
          ...explainStep(s, name).map((line) => ({ text: line, style: 'small' })),
        ],
        margin: [0, 0, 0, 3] as [number, number, number, number],
      })),
    );
  if (d.result.judgeTies.length)
    out.push(
      { text: 'Equal sums from one judge (rule 3)', style: 'h2' },
      ...d.result.judgeTies.map((t) => ({ text: explainJudgeTie(t, name, judge), style: 'small' })),
    );
  return out;
}

function detailTables(d: EventData): Content[] {
  return d.segments.flatMap((seg) => {
    const multi = seg.markKeys.length > 1;
    const { th, layout } = clubTable(d);
    const head: TableCell[] = [
      th(entryHeading[d.event.entryType], { alignment: 'left' }),
      ...d.judges.flatMap((_, ji) =>
        seg.markKeys.map((k) => th(`J${ji + 1}${multi ? ` ${markKeyLabel(k)}` : ''}`)),
      ),
    ];
    const rows: TableCell[][] = d.rows.map((r) => [
      r.name,
      ...d.judges.flatMap((j) =>
        seg.markKeys.map((k) => ({
          text: formatTenths(d.mark(k, j.id, r.id)),
          alignment: 'center' as const,
        })),
      ),
    ]);
    return [
      { text: seg.name, style: 'h2' },
      {
        table: {
          headerRows: 1,
          widths: ['*', ...d.judges.flatMap(() => seg.markKeys.map(() => 34))],
          body: [head, ...rows],
        },
        layout,
        fontSize: 9,
      } as Content,
    ];
  });
}

/** Standard and guest results fit several events per page; with-marks gets a page per event. */
const sharesPages = (style: ResultsStyle) => style !== 'withMarks';

export function resultsPages(events: EventData[], style: ResultsStyle): Content[] {
  const pages = events
    .filter((d) => d.result.complete)
    .map((d): Content[] => [
      ...header(d, undefined, !sharesPages(style)),
      resultsTable(d, style === 'guest'),
      ...(style === 'guest' ? [] : ruleKey(d)),
      officialsBlock(d),
      ...(style === 'withMarks' ? [...tieNotes(d), ...victoriesTable(d), ...detailTables(d)] : []),
    ]);
  if (!sharesPages(style)) return withPageBreaks(pages);
  // Shorter results share pages: events follow on in order, each kept whole (moved to the next page
  // rather than split). An event taller than a whole page still has to break.
  return pages.map((content, i) => ({
    stack: content,
    unbreakable: true,
    ...(i > 0 ? { margin: [0, 24, 0, 0] as [number, number, number, number] } : {}),
  }));
}

function withPageBreaks(pages: Content[][]): Content[] {
  return pages.map((content, i) => ({
    stack: content,
    ...(i > 0 ? { pageBreak: 'before' as const } : {}),
  }));
}

export function resultsDocument(events: EventData[], style: ResultsStyle): TDocumentDefinitions {
  const first = events[0];
  return document(
    resultsPages(events, style),
    false,
    sharesPages(style) && first ? compLine(first) : undefined,
  );
}

/** Judges' sheets are handed out loose, one or more per official, so they carry no page numbers. */
export function judgeSheetsDocument(events: EventData[]): TDocumentDefinitions {
  return document(judgeSheets(events), true, undefined, false);
}

/** `pageHeader` is repeated at the top of every page. */
export function document(
  content: Content[],
  landscape = false,
  pageHeader?: string,
  pageNumbers = true,
): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageOrientation: landscape ? 'landscape' : 'portrait',
    pageMargins: [36, pageHeader ? 52 : 36, 36, 40],
    ...(pageHeader && {
      header: {
        text: pageHeader,
        style: 'comp',
        margin: [36, 24, 36, 0] as [number, number, number, number],
      },
    }),
    defaultStyle: { fontSize: 10 },
    styles,
    content: content.length ? content : [{ text: 'Nothing to print.' }],
    footer: (page, pages) => ({
      text: 'Created with Podium' + (pageNumbers ? ` · page ${page} of ${pages}` : ''),
      alignment: 'center',
      fontSize: 8,
      color: '#888',
    }),
  };
}
