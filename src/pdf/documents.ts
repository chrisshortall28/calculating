import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { markKeyLabel } from '../domain/segments';
import { formatTenths } from '../marks/parseMark';
import { ordinalLabel } from '../scoring';
import type { EventData } from './loadEvent';

const styles: TDocumentDefinitions['styles'] = {
  comp: { fontSize: 10, color: '#555' },
  title: { fontSize: 16, bold: true, margin: [0, 2, 0, 8] },
  h2: { fontSize: 12, bold: true, margin: [0, 10, 0, 4] },
  th: { bold: true, fontSize: 9, fillColor: '#eeeeee', alignment: 'center' },
  small: { fontSize: 8, color: '#555' },
};

function compLine(d: EventData) {
  const c = d.competition;
  return [c.name, c.date && new Date(c.date).toLocaleDateString(), c.venue].filter(Boolean).join(' · ');
}

function header(d: EventData, subtitle?: string): Content[] {
  return [
    { text: compLine(d), style: 'comp' },
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

/** Landscape sheet: each compulsory dance gets a wide Comments column and a Mark column; the free
 * dance gets A and B; Total points and Place sit on the far right. */
function judgeSheetPage(d: EventData, { role, label, name }: Official): Content[] {
  const MARK_WIDTH = 38;
  const columns = d.segments.map((s) =>
    s.kind === 'compulsory'
      ? {
          name: s.name,
          subs: [
            { label: 'Comments', width: '*' as const },
            { label: 'Mark', width: MARK_WIDTH },
          ],
        }
      : { name: s.name, subs: s.markKeys.map((k) => ({ label: markKeyLabel(k), width: MARK_WIDTH })) },
  );
  const subCols = columns.flatMap((c) => c.subs);

  const headRow1: TableCell[] = [
    { text: '#', style: 'th', rowSpan: 2 },
    { text: 'Entry', style: 'th', rowSpan: 2, alignment: 'left' },
    ...columns.flatMap((c) => {
      const cells: TableCell[] = [{ text: c.name, style: 'th', colSpan: c.subs.length }];
      for (let i = 1; i < c.subs.length; i++) cells.push({});
      return cells;
    }),
    { text: 'Total points', style: 'th', rowSpan: 2 },
    { text: 'Place', style: 'th', rowSpan: 2 },
  ];
  const headRow2: TableCell[] = [{}, {}, ...subCols.map((s) => ({ text: s.label, style: 'th' })), {}, {}];
  // Repeats at the top of every page, so a continuation page still says whose sheet it is.
  const colCount = headRow2.length;
  const official = [role, label, name].filter(Boolean).join(' ');
  const noBorder: [boolean, boolean, boolean, boolean] = [false, false, false, false];
  const captionRow: TableCell[] = [
    {
      text: `${d.event.name} · ${official}`,
      colSpan: colCount,
      style: 'small',
      margin: [0, 0, 0, 2],
      border: noBorder,
    },
    // Spanned cells draw their own borders too, so blank them as well.
    ...Array.from({ length: colCount - 1 }, () => ({ text: '', border: noBorder })),
  ];
  const body: TableCell[][] = [
    captionRow,
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
      { text: '' },
      { text: '' },
    ]),
  ];

  return [
    ...header(d, `${role}’s sheet`),
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
        headerRows: 3,
        dontBreakRows: true,
        // Comments columns share the spare width; with no compulsory dances, the Entry column takes it.
        widths: [
          18,
          subCols.some((s) => s.width === '*') ? 130 : '*',
          ...subCols.map((s) => s.width),
          44,
          34,
        ],
        body,
      },
      // The caption row's top edge comes from the table layout, not the cell borders.
      layout: { hLineWidth: (i: number) => (i === 0 ? 0 : 1) },
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
    for (const o of officials) pages.push(judgeSheetPage(d, o));
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

/** The event's officials as labelled lines, for the top of the results. */
function officialsBlock(d: Officials): Content {
  const row = (label: string, value: string) => [{ text: label, bold: true }, { text: value }];
  return {
    table: { widths: [52, '*'], body: [row('Judges', judgesText(d)), row('Referee', refereeText(d))] },
    layout: 'noBorders',
    margin: [0, 0, 0, 8],
  };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * - `standard`: placings with major victories, total points and each judge's ranking
 * - `withMarks`: standard plus every judge's marks and the placing explanation for each dance
 * - `guest`: for events with guest judges — placings only (place, entry, club), no scores
 */
export type ResultsStyle = 'standard' | 'withMarks' | 'guest';

function resultsTable(d: EventData, placingsOnly: boolean): Content {
  const { result } = d;
  const name = new Map(d.rows.map((r) => [r.id, r]));
  const center = 'center' as const;
  const body: TableCell[][] = [
    [
      { text: 'Place', style: 'th' },
      { text: 'Entry', style: 'th', alignment: 'left' },
      { text: 'Club', style: 'th', alignment: 'left' },
      ...(placingsOnly
        ? []
        : [
            { text: 'Major victories', style: 'th' },
            { text: 'Total points', style: 'th' },
            ...d.judges.map((_, i) => ({ text: `J${i + 1}`, style: 'th' })),
          ]),
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
              { text: String(o.majorVictories), bold: true, alignment: center },
              { text: formatTenths(o.totalTenths), alignment: center },
              ...o.judgeRanks.map((rank) => ({ text: String(rank), alignment: center, color: '#555' })),
            ]),
      ];
    }),
  ];
  return {
    table: {
      headerRows: 1,
      widths: placingsOnly ? [34, '*', 180] : [34, '*', 110, 48, 44, ...d.judges.map(() => 24)],
      body,
    },
    layout: 'lightHorizontalLines',
  };
}

function detailTables(d: EventData): Content[] {
  const name = new Map(d.rows.map((r) => [r.id, r.name]));
  return d.segments.flatMap((seg, si) => {
    const sr = d.result.segments[si]!;
    const multi = seg.markKeys.length > 1;
    const head: TableCell[] = [
      { text: 'Entry', style: 'th', alignment: 'left' },
      ...d.judges.flatMap((_, ji) => [
        ...seg.markKeys.map((k) => ({
          text: `J${ji + 1}${multi ? ` ${markKeyLabel(k)}` : ''}`,
          style: 'th',
        })),
        { text: 'Pl', style: 'th' },
      ]),
      { text: 'Place', style: 'th' },
    ];
    const rows: TableCell[][] = d.rows.map((r) => [
      r.name,
      ...d.judges.flatMap((j) => [
        ...seg.markKeys.map((k) => ({
          text: formatTenths(d.mark(k, j.id, r.id)),
          alignment: 'center' as const,
        })),
        { text: String(sr.ordinals.get(j.id)?.get(r.id) ?? ''), alignment: 'center' as const, color: '#555' },
      ]),
      { text: String(sr.places.get(r.id) ?? ''), bold: true, alignment: 'center' as const },
    ]);
    const steps = sr.steps.map((s) => ({
      text: `${ordinalLabel(s.place)}: ${s.entryIds.map((id) => name.get(id)).join(', ')} — ${s.rule}: ${s.detail}`,
      style: 'small',
    }));
    return [
      { text: seg.name, style: 'h2' },
      {
        table: {
          headerRows: 1,
          widths: ['*', ...d.judges.flatMap(() => [...seg.markKeys.map(() => 30), 18]), 34],
          body: [head, ...rows],
        },
        layout: 'lightHorizontalLines',
        fontSize: 9,
      } as Content,
      { stack: steps, margin: [0, 4, 0, 0] },
    ];
  });
}

export function resultsPages(events: EventData[], style: ResultsStyle): Content[] {
  const pages = events
    .filter((d) => d.result.complete)
    .map((d): Content[] => [
      ...header(d, 'Results'),
      officialsBlock(d),
      resultsTable(d, style === 'guest'),
      ...(style === 'withMarks' ? detailTables(d) : []),
    ]);
  return withPageBreaks(pages);
}

function withPageBreaks(pages: Content[][]): Content[] {
  return pages.map((content, i) => ({
    stack: content,
    ...(i > 0 ? { pageBreak: 'before' as const } : {}),
  }));
}

export function document(content: Content[], landscape = false): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageOrientation: landscape ? 'landscape' : 'portrait',
    pageMargins: [36, 36, 36, 40],
    defaultStyle: { fontSize: 10 },
    styles,
    content: content.length ? content : [{ text: 'Nothing to print.' }],
    footer: (page, pages) => ({
      text: `Podium · page ${page} of ${pages}`,
      alignment: 'center',
      fontSize: 8,
      color: '#888',
    }),
  };
}
