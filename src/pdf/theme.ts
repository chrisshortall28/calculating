import { isLightColor, luminance } from '@mantine/core';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { clubColors, DEFAULT_PRIMARY, onColor } from '../app/clubColors';
import type { Competition } from '../domain/types';

// The look the programme, skating order and results PDFs share: the club colours across the top of each
// page, a title band for each event, and lightly ruled tables.

export function palette(c: Competition) {
  const { primary, secondary } = clubColors(c);
  return {
    primary,
    secondary,
    onPrimary: onColor(primary),
    /** Headings on white paper: the primary colour unless it is too pale to read. */
    ink: isLightColor(primary) ? DEFAULT_PRIMARY : primary,
    /** Accent rules on white paper: the secondary colour unless it is too pale to see. */
    accent: luminance(secondary) > 0.75 ? (isLightColor(primary) ? DEFAULT_PRIMARY : primary) : secondary,
  };
}

/** A thin band of the club colours across the very top of a page, for a document's `background`. */
export function colourBand(c: Competition, pageWidth: number): Content {
  const { primary, secondary } = palette(c);
  return {
    absolutePosition: { x: 0, y: 0 },
    canvas: [
      { type: 'rect', x: 0, y: 0, w: pageWidth, h: 8, color: primary },
      { type: 'rect', x: 0, y: 8, w: pageWidth, h: 3, color: secondary },
    ],
  };
}

/** An event's title bar: its number in a tile of the accent colour, then the title on the primary colour. */
export function eventBand(
  c: Competition,
  band: { number: number; title: string; subtitle?: string; /** Link destination */ id?: string },
): Content {
  const { primary, onPrimary, accent } = palette(c);
  return {
    table: {
      widths: [44, '*'],
      body: [
        [
          {
            stack: [
              { text: 'EVENT', fontSize: 7, bold: true, characterSpacing: 1 },
              { text: String(band.number), fontSize: 20, bold: true },
            ],
            fillColor: accent,
            color: onColor(accent),
            alignment: 'center',
            margin: [0, 3, 0, 0],
          },
          {
            stack: [
              { text: band.title, fontSize: 15, bold: true, ...(band.id && { id: band.id }) },
              ...(band.subtitle
                ? [{ text: band.subtitle, fontSize: 9, margin: [0, 2, 0, 0] as Margins }]
                : []),
            ],
            fillColor: primary,
            color: onPrimary,
            // A title on its own sits in the middle of the band.
            margin: band.subtitle ? [6, 5, 6, 5] : [6, 10, 6, 5],
          },
        ],
      ],
    },
    // A white gap between the number tile and the band, which may share a colour.
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i: number) => (i === 1 ? 3 : 0),
      vLineColor: () => '#ffffff',
    },
  };
}

type Margins = [number, number, number, number];

/** Small grey column headings; goes in a document's `styles` as `progTh`. */
export const tableHeadingStyle: NonNullable<TDocumentDefinitions['styles']>[string] = {
  fontSize: 8,
  bold: true,
  color: '#666',
  characterSpacing: 0.5,
};

/**
 * Tables with no boxes: plain headings (`th`, centred unless told otherwise) ruled off in the accent
 * colour, and light rules between the rows.
 */
export function ruledTable(c: Competition) {
  const { accent } = palette(c);
  const headerRows = (node: { table: { headerRows?: number } }) => node.table.headerRows ?? 1;
  return {
    th: (text: string, extra: Record<string, unknown> = {}): TableCell => ({
      text,
      style: 'progTh',
      alignment: 'center',
      ...extra,
    }),
    layout: {
      hLineWidth: (i: number, node: { table: { headerRows?: number } }) =>
        i === 0 ? 0 : i === headerRows(node) ? 1.5 : 0.5,
      hLineColor: (i: number, node: { table: { headerRows?: number } }) =>
        i === headerRows(node) ? accent : '#dddddd',
      vLineWidth: () => 0,
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  };
}
