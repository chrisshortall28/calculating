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

function judgeSheetPage(d: EventData, { role, label, name }: Official): Content[] {
  const markCols = d.segments.flatMap((s) => s.markKeys.map((k) => ({ seg: s, key: k })));
  const headRow1: TableCell[] = [
    { text: '#', style: 'th', rowSpan: 2 },
    { text: 'Entry', style: 'th', rowSpan: 2, alignment: 'left' },
    ...d.segments.flatMap((s) => {
      const cells: TableCell[] = [{ text: s.name, style: 'th', colSpan: s.markKeys.length }];
      for (let i = 1; i < s.markKeys.length; i++) cells.push({});
      return cells;
    }),
  ];
  const headRow2: TableCell[] = [
    {},
    {},
    ...markCols.map(({ key }) => ({ text: markKeyLabel(key) || 'Mark', style: 'th' })),
  ];
  const body: TableCell[][] = [
    headRow1,
    headRow2,
    ...d.rows.map((r, i) => [
      {
        text: String(i + 1),
        alignment: 'center' as const,
        margin: [0, 6, 0, 6] as [number, number, number, number],
      },
      {
        stack: [
          { text: r.name, bold: true },
          { text: [r.club, r.members].filter(Boolean).join(' · '), style: 'small' },
        ],
      },
      ...markCols.map(() => ({ text: '' })),
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
        { text: `${d.rows.length} entries`, alignment: 'right', style: 'comp' },
      ],
      margin: [0, 0, 0, 8],
    },
    {
      table: {
        headerRows: 2,
        dontBreakRows: true,
        widths: [22, '*', ...markCols.map(() => 52)],
        body,
      },
    },
    {
      text: 'Marks out of 10.0, one decimal place.',
      style: 'small',
      margin: [0, 6, 0, 0],
    },
    {
      columns: [
        { text: 'Signature: ______________________________' },
        { text: 'Date: ______________', alignment: 'right' },
      ],
      margin: [0, 30, 0, 0],
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

function resultsTable(d: EventData): Content {
  const { result } = d;
  const name = new Map(d.rows.map((r) => [r.id, r]));
  const center = 'center' as const;
  const body: TableCell[][] = [
    [
      { text: 'Place', style: 'th' },
      { text: 'Entry', style: 'th', alignment: 'left' },
      { text: 'Club', style: 'th', alignment: 'left' },
      { text: 'Major victories', style: 'th' },
      { text: 'Total points', style: 'th' },
      ...d.judges.map((_, i) => ({ text: `J${i + 1}`, style: 'th' })),
    ],
    ...result.overall.map((o) => {
      const r = name.get(o.entryId)!;
      return [
        { text: `${o.place}${o.tied ? '=' : ''}`, bold: true, alignment: center, fontSize: 12 },
        {
          stack: [{ text: r.name, bold: true }, ...(r.members ? [{ text: r.members, style: 'small' }] : [])],
        },
        r.club,
        { text: String(o.majorVictories), bold: true, alignment: center },
        { text: formatTenths(o.totalTenths), alignment: center },
        ...o.judgeRanks.map((rank) => ({ text: String(rank), alignment: center, color: '#555' })),
      ];
    }),
  ];
  return {
    table: {
      headerRows: 1,
      widths: [34, '*', 110, 48, 44, ...d.judges.map(() => 24)],
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

export function resultsPages(events: EventData[], withDetail: boolean): Content[] {
  const pages = events
    .filter((d) => d.result.complete)
    .map((d): Content[] => [
      ...header(d, 'Results'),
      officialsBlock(d),
      resultsTable(d),
      ...(withDetail ? detailTables(d) : []),
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
