import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { formatLongDate } from '../app/format';
import { entryHeading, entryNoun } from '../domain/entryName';
import type { Competition, EntryType } from '../domain/types';
import type { EventData } from './loadEvent';
import { coverSwooshes } from './coverSwooshes';
import { colourBand, eventBand, palette, ruledTable, tableHeadingStyle } from './theme';

// A spectators' programme: a club-coloured cover, a welcome page listing the events, then each
// event's skaters in skating order with its dances. It never names the judges or shows marks.

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const MARGIN = 48;

type Margins = [number, number, number, number];

/** The standard welcome, used when the competition has none of its own. */
export function defaultWelcome(c: Competition): string {
  const at = c.venue ? ` at ${c.venue}` : '';
  return [
    `Welcome to ${c.name}${at}, and thank you for coming along to support our skaters.`,
    'The events are listed below in the order they will be skated. The pages that follow show the skaters in each event in their skating order, and the dances they will perform.',
    'Please give every skater a warm round of applause, and enjoy the competition!',
  ].join('\n\n');
}

/** "8 skaters", "1 duo", "3 teams" */
export function entryCount(type: EntryType, count: number): string {
  return `${count} ${entryNoun[type][count === 1 ? 0 : 1]}`;
}

const danceNames = (d: EventData) => d.segments.map((s) => s.name);

/** Destination id of an event's section, for the page numbers and links in the list of events. */
const anchor = (d: EventData) => `event-${d.event.id}`;

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

function coverBackground(c: Competition): Content {
  const { primary, secondary, onPrimary } = palette(c);
  return {
    svg: coverSwooshes(PAGE.width, PAGE.height, {
      background: primary,
      accent: secondary,
      contrast: onPrimary,
    }),
    width: PAGE.width,
    absolutePosition: { x: 0, y: 0 },
  };
}

function cover(c: Competition): Content[] {
  const { secondary, onPrimary } = palette(c);
  const date = formatLongDate(c.date);
  return [
    {
      stack: [
        { text: 'PROGRAMME', fontSize: 13, bold: true, characterSpacing: 6, color: secondary },
        {
          text: c.name,
          fontSize: c.name.length > 40 ? 28 : 36,
          bold: true,
          color: onPrimary,
          lineHeight: 1.05,
          margin: [0, 8, 0, 14],
        },
        ...(date ? [{ text: date, fontSize: 15, color: onPrimary }] : []),
        ...(c.venue
          ? [{ text: c.venue, fontSize: 15, color: onPrimary, margin: [0, 2, 0, 0] as Margins }]
          : []),
      ],
      absolutePosition: { x: MARGIN, y: 560 },
    },
  ];
}

// ---------------------------------------------------------------------------
// Welcome and the list of events
// ---------------------------------------------------------------------------

/** A short, thick rule in the accent colour under a heading. */
const accentRule = (color: string, margin: Margins = [0, 6, 0, 16]): Content => ({
  canvas: [{ type: 'line', x1: 0, y1: 0, x2: 56, y2: 0, lineWidth: 3, lineColor: color }],
  margin,
});

function welcomePage(c: Competition, events: EventData[]): Content[] {
  const { primary, onPrimary, ink, accent } = palette(c);
  const message = (c.welcome?.trim() || defaultWelcome(c)).split(/\n\s*\n/);
  const cellPad = (i: number) => (i === 0 ? 0 : 4);
  return [
    { text: 'Welcome', fontSize: 30, bold: true, color: ink },
    accentRule(accent),
    ...message.map((p) => ({
      text: p.trim(),
      fontSize: 12,
      lineHeight: 1.35,
      margin: [0, 0, 0, 10] as Margins,
    })),
    { text: 'Events', fontSize: 20, bold: true, color: ink, margin: [0, 18, 0, 0] },
    accentRule(accent, [0, 6, 0, 10]),
    events.length === 0
      ? { text: 'The events will be announced on the day.', italics: true, color: '#555' }
      : {
          table: {
            headerRows: 1,
            widths: [22, '*', 'auto', 34],
            body: [
              [
                { text: '', fillColor: primary },
                { text: 'Event', bold: true, color: onPrimary, fillColor: primary },
                { text: 'Entries', bold: true, color: onPrimary, fillColor: primary },
                { text: 'Page', bold: true, color: onPrimary, fillColor: primary, alignment: 'right' },
              ],
              ...events.map((d, i): TableCell[] => [
                { text: String(i + 1), bold: true, color: ink, alignment: 'right' },
                {
                  stack: [
                    { text: d.event.name, bold: true, linkToDestination: anchor(d) },
                    ...(d.segments.length
                      ? [{ text: danceNames(d).join(' · '), fontSize: 9, color: '#555' }]
                      : []),
                  ],
                },
                { text: entryCount(d.event.entryType, d.rows.length), color: '#555' },
                {
                  pageReference: anchor(d),
                  alignment: 'right',
                  color: ink,
                },
              ]),
            ],
          },
          layout: {
            hLineWidth: (i: number) => (i === 0 ? 0 : i === 1 ? 2 : 0.5),
            hLineColor: (i: number) => (i === 1 ? accent : '#dddddd'),
            vLineWidth: () => 0,
            paddingLeft: cellPad,
            paddingRight: () => 4,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        },
  ];
}

// ---------------------------------------------------------------------------
// Events: the skating order
// ---------------------------------------------------------------------------

function eventSection(c: Competition, d: EventData, number: number): Content {
  const { ink } = palette(c);
  const type = d.event.entryType;
  const band = eventBand(c, {
    number,
    title: d.event.name,
    subtitle: entryCount(type, d.rows.length),
    id: anchor(d),
  });
  const dances: Content = d.segments.length
    ? {
        text: [
          {
            text:
              d.event.discipline === 'figures'
                ? 'Figures & free  '
                : d.segments.length === 1
                  ? 'Dance  '
                  : 'Dances  ',
            bold: true,
            color: ink,
          },
          danceNames(d).join('  ·  '),
        ],
        margin: [0, 8, 0, 6],
      }
    : { text: '', margin: [0, 4, 0, 0] };
  // A rotating start order: each compulsory dance or figure begins with a different skater, so the table says
  // which dances each skater starts.
  const startsBy = new Map<number, string[]>();
  for (const seg of d.segments) {
    const at = d.firstSkaters.get(seg.id);
    if (at !== undefined) startsBy.set(at, [...(startsBy.get(at) ?? []), seg.name]);
  }
  const rotating = d.rows.length > 0 && startsBy.size > 0;
  const order: Content =
    d.rows.length === 0
      ? { text: 'Entries to be confirmed.', italics: true, color: '#555' }
      : {
          table: {
            headerRows: 1,
            widths: [30, '*', '*', ...(rotating ? [110] : [])],
            body: [
              [
                { text: 'Order', style: 'progTh', alignment: 'center' },
                { text: entryHeading[type], style: 'progTh' },
                { text: 'Club', style: 'progTh' },
                ...(rotating ? [{ text: 'Skates first', style: 'progTh' }] : []),
              ],
              ...d.rows.map((r, i): TableCell[] => [
                { text: String(i + 1), bold: true, color: ink, alignment: 'center', fontSize: 12 },
                {
                  stack: [
                    { text: r.name, bold: true, fontSize: 11 },
                    ...(r.members ? [{ text: r.members, fontSize: 8.5, color: '#555' }] : []),
                  ],
                },
                { text: r.club, color: '#444' },
                ...(rotating
                  ? [{ text: (startsBy.get(i) ?? []).join(', '), bold: true, color: ink, fontSize: 9 }]
                  : []),
              ]),
            ],
          },
          layout: ruledTable(c).layout,
        };
  return { stack: [band, dances, order] };
}

/** Events follow on down the page, each kept whole where it fits (moved to the next page rather than split). */
function eventPages(c: Competition, events: EventData[]): Content[] {
  return events.map((d, i) => ({
    stack: [eventSection(c, d, i + 1)],
    unbreakable: true,
    margin: [0, i === 0 ? 0 : 26, 0, 0] as Margins,
    ...(i === 0 ? { pageBreak: 'before' as const } : {}),
  }));
}

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

export function programmeDocument(c: Competition, events: EventData[]): TDocumentDefinitions {
  const { ink } = palette(c);
  return {
    pageSize: 'A4',
    pageMargins: [MARGIN, 56, MARGIN, 48],
    // Inner pages carry a thin band of the club colours across the top.
    background: (page) => (page === 1 ? coverBackground(c) : colourBand(c, PAGE.width)),
    header: (page) =>
      page <= 2
        ? null
        : {
            text: c.name,
            fontSize: 8,
            color: ink,
            bold: true,
            margin: [MARGIN, 24, MARGIN, 0] as Margins,
          },
    footer: (page) =>
      page === 1
        ? null
        : {
            columns: [
              { text: 'Created with Podium', fontSize: 8, color: '#888' },
              { text: String(page), fontSize: 9, color: ink, bold: true, alignment: 'right' },
            ],
            margin: [MARGIN, 12, MARGIN, 0] as Margins,
          },
    defaultStyle: { fontSize: 10 },
    styles: { progTh: tableHeadingStyle },
    content: [...cover(c), { stack: welcomePage(c, events), pageBreak: 'before' }, ...eventPages(c, events)],
  };
}
