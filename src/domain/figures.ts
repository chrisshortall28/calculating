/**
 * The compulsory figures catalogue. A figure's `id` is its number, which is stored in mark keys
 * (`cf:<id>:<side>`), so numbers must never be reused for a different figure.
 */
export interface Figure {
  id: string;
  name: string;
  /** Edges skated, without the starting foot: e.g. "FO - BI". */
  direction: string;
}

const list: [string, string][] = [
  ['Eights', 'FO - FO'],
  ['Eights', 'FI - FI'],
  ['Eights', 'BO - BO'],
  ['Eights', 'BI - BI'],
  ['Change Eights', 'FOI - FIO'],
  ['Change Eights', 'BOI - BIO'],
  ['Threes', 'FO - FO'],
  ['Threes', 'FO - BI'],
  ['Threes', 'FI - BO'],
  ['Double Threes', 'FO - FO'],
  ['Double Threes', 'FI - FI'],
  ['Double Threes', 'BO - BO'],
  ['Double Threes', 'BI - BI'],
  ['Loops', 'FO - FO'],
  ['Loops', 'FI - FI'],
  ['Loops', 'BO - BO'],
  ['Loops', 'BI - BI'],
  ['Brackets', 'FO - BI'],
  ['Brackets', 'FI - BO'],
  ['Rockers', 'FO - BO'],
  ['Rockers', 'FI - BI'],
  ['Counters', 'FO - BO'],
  ['Counters', 'FI - BI'],
  ['One Foot Eights', 'FOI - FIO'],
  ['One Foot Eights', 'BOI - BIO'],
  ['Change Threes', 'FOI - BOI'],
  ['Change Threes', 'FIO - BIO'],
  ['Change Double Threes', 'FOI - FIO'],
  ['Change Double Threes', 'BOI - BIO'],
  ['Change Loops', 'FOI - FIO'],
  ['Change Loops', 'BOI - BIO'],
  ['Change Brackets', 'FOI - BO'],
  ['Change Brackets', 'FIO - BIO'],
  ['Paragraph Threes', 'FO - FI'],
  ['Paragraph Threes', 'BO - BI'],
  ['Paragraph Double Threes', 'FO - FI'],
  ['Paragraph Double Threes', 'BO - BI'],
  ['Paragraph Loops', 'FOI - FIO'],
  ['Paragraph Loops', 'BOI - BIO'],
  ['Paragraph Brackets', 'FO - FI'],
  ['Paragraph Brackets', 'BO - BI'],
];

export const FIGURES: Figure[] = list.map(([name, direction], i) => ({ id: String(i + 1), name, direction }));

const byId = new Map(FIGURES.map((f) => [f.id, f]));

export const getFigure = (id: string) => byId.get(id);

/** "39. Paragraph Loops BOI - BIO" */
export function figureLabel(id: string): string {
  const f = byId.get(id);
  return f ? `${f.id}. ${f.name} ${f.direction}` : `Unknown figure ${id}`;
}
