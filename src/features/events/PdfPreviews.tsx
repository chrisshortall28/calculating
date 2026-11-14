import { Text } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './PdfPreviews.module.css';

/** Conceptual mini pages: they show the shape of a PDF and update with the choices, but are not the PDF. */

const MAX_PAGES = 3;
const MAX_ROWS = 7;

function Paper({ landscape, children }: { landscape?: boolean; children: ReactNode }) {
  return <div className={`${classes.paper} ${landscape ? classes.landscape : ''}`}>{children}</div>;
}

function Heading({ title, side }: { title: string; side?: string }) {
  return (
    <div className={classes.heading}>
      <b>{title}</b>
      {side && <span>{side}</span>}
    </div>
  );
}

const rows = (n: number, max = MAX_ROWS) =>
  Array.from({ length: Math.min(Math.max(n, 1), max) }, (_, i) => i);

function More({ count, noun }: { count: number; noun: string }) {
  return count > 0 ? (
    <Text className={classes.more}>
      +{count} more {noun}
      {count === 1 ? '' : 's'}
    </Text>
  ) : null;
}

/** Splits into as few groups of at most `size` as fit, sharing them out evenly (5 → 3 + 2), like the real sheets. */
export function splitEvenly<T>(items: T[], size: number): T[][] {
  const count = Math.ceil(items.length / size);
  const each = Math.ceil(items.length / Math.max(count, 1));
  return Array.from({ length: count }, (_, i) => items.slice(i * each, (i + 1) * each));
}

/** One page per part, listing the skaters from the part's first skater (`firstNumber`: its start number). */
export function SkatingOrderPreview({
  parts,
  entries,
}: {
  parts: { name: string; firstNumber: number; rotates: boolean }[];
  entries: number;
}) {
  const shown = parts.slice(0, MAX_PAGES);
  return (
    <div className={classes.stage} data-testid="skating-order-preview">
      <div className={classes.pages}>
        {shown.map((p, k) => (
          <Paper key={k}>
            <Heading title={p.name} side="Skating order" />
            {rows(entries).map((i) => {
              const n = ((p.firstNumber - 1 + i) % Math.max(entries, 1)) + 1;
              const first = p.rotates && i === 0;
              return (
                <div
                  key={i}
                  className={`${classes.row} ${first ? classes.first : ''}`}
                  style={{ gridTemplateColumns: '10px 1fr' }}
                >
                  <span className={classes.num}>{n}</span>
                  <span className={`${classes.bar} ${i % 2 ? classes.short : ''}`} />
                </div>
              );
            })}
          </Paper>
        ))}
        <More count={parts.length - shown.length} noun="page" />
      </div>
    </div>
  );
}

const gridColumns = (parts: number, totals: boolean) =>
  `10px 1fr ${'1.3fr 9px '.repeat(parts)}${totals ? '12px 9px' : ''}`.trim();

function Sheet({
  names,
  totals,
  entries,
  title,
}: {
  names: string[];
  totals: boolean;
  entries: number;
  title: string;
}) {
  const template = gridColumns(names.length, totals);
  return (
    <Paper landscape>
      <Heading title={title} side="J1" />
      <div className={classes.row} style={{ gridTemplateColumns: template, borderBottom: 'none' }}>
        <span className={classes.head}>#</span>
        <span className={classes.head}>Skater</span>
        {names.map((n) => (
          <span key={n} className={classes.partName} style={{ gridColumn: 'span 2' }}>
            {n}
          </span>
        ))}
        {totals && (
          <>
            <span className={classes.head}>Tot</span>
            <span className={classes.head}>Pl</span>
          </>
        )}
      </div>
      {rows(entries, 5).map((i) => (
        <div key={i} className={classes.row} style={{ gridTemplateColumns: template }}>
          <span className={classes.num}>{i + 1}</span>
          <span className={`${classes.bar} ${i % 2 ? classes.short : ''}`} />
          {names.flatMap((n) => [
            <span key={`${n}-c`} className={classes.cell} />,
            <span key={`${n}-m`} className={classes.mark} />,
          ])}
          {totals && (
            <>
              <span className={classes.mark} />
              <span className={classes.mark} />
            </>
          )}
        </div>
      ))}
    </Paper>
  );
}

/** One wide sheet for several parts, or a stack of single-part sheets, with the judge's label on top. */
export function JudgeSheetsPreview({
  parts,
  layout,
  entries,
  totals,
}: {
  parts: string[];
  layout: 'combined' | 'perPart';
  entries: number;
  /** Total points and Place columns (only when every part is printed together). */
  totals: boolean;
}) {
  if (layout === 'combined') {
    // The real sheets hold four parts at most; the preview shows the first sheet.
    const sheets = splitEvenly(parts, 4);
    const first = sheets[0] ?? [];
    return (
      <div className={classes.stage} data-testid="judge-sheets-preview">
        <div className={classes.pages}>
          <Sheet names={first} totals={totals && sheets.length === 1} entries={entries} title="Judge sheet" />
          <More count={sheets.length - 1} noun="more sheet" />
        </div>
      </div>
    );
  }
  const shown = parts.slice(0, MAX_PAGES);
  return (
    <div className={classes.stage} data-testid="judge-sheets-preview">
      <div className={classes.pages}>
        <div className={classes.stack}>
          {shown.map((n, k) => (
            <Sheet key={k} names={[n]} totals={false} entries={entries} title={n} />
          ))}
        </div>
        <More count={parts.length - shown.length} noun="sheet" />
      </div>
    </div>
  );
}

/** The results page in one of its three styles. */
export function ResultsPreview({
  style,
  entries,
  judges,
}: {
  style: 'standard' | 'withMarks' | 'guest';
  entries: number;
  judges: number;
}) {
  const marks = style === 'withMarks' ? Math.min(Math.max(judges, 1), 4) : 0;
  const cols =
    style === 'guest' ? '12px 1fr' : `12px 1fr ${'12px '.repeat(marks)}18px 12px`.replace(/\s+/g, ' ');
  return (
    <div className={classes.stage} data-testid="results-preview">
      <div className={classes.pages}>
        <Paper landscape={style === 'withMarks'}>
          <Heading
            title="Final results"
            side={style === 'guest' ? 'placings only' : style === 'withMarks' ? 'with marks' : undefined}
          />
          <div className={classes.row} style={{ gridTemplateColumns: cols, borderBottom: 'none' }}>
            <span className={classes.head}>Pl</span>
            <span className={classes.head}>Skater</span>
            {style !== 'guest' && (
              <>
                {Array.from({ length: marks }, (_, j) => (
                  <span key={j} className={classes.head}>
                    J{j + 1}
                  </span>
                ))}
                <span className={classes.head}>Pts</span>
                <span className={classes.head}>Rule</span>
              </>
            )}
          </div>
          {rows(entries).map((i) => (
            <div key={i} className={classes.row} style={{ gridTemplateColumns: cols }}>
              <span className={classes.num}>{i + 1}</span>
              <span className={`${classes.bar} ${i % 2 ? classes.short : ''}`} />
              {style !== 'guest' && (
                <>
                  {Array.from({ length: marks }, (_, j) => (
                    <span key={j} className={classes.bar} style={{ width: 8 }} />
                  ))}
                  <span className={classes.bar} style={{ width: 14 }} />
                  <span className={classes.num}>{i === 1 ? '6A' : ''}</span>
                </>
              )}
            </div>
          ))}
        </Paper>
      </div>
    </div>
  );
}

/** The spectators' programme: a cover in the club colours, then a welcome page listing the events. */
export function ProgrammePreview({
  title,
  events,
  colors,
}: {
  title: string;
  /** Each event's number as the programme shows it (its own, or its place in the running order) and name. */
  events: { number: string; name: string }[];
  colors: { primary: string; secondary: string };
}) {
  return (
    <div className={classes.stage} data-testid="programme-preview">
      <div className={classes.pages}>
        <div className={classes.paper} style={{ background: colors.primary, color: '#fff', padding: 0 }}>
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: 8,
            }}
          >
            <div style={{ height: 2, width: 24, marginBottom: 6, background: colors.secondary }} />
            <b style={{ fontSize: 9, lineHeight: 1.15 }}>{title}</b>
          </div>
        </div>
        <Paper>
          <Heading title="Welcome" side="programme" />
          {[0, 1, 2].map((i) => (
            <div key={i} className={classes.row} style={{ gridTemplateColumns: '1fr', borderBottom: 'none' }}>
              <span className={classes.bar} />
            </div>
          ))}
          <div style={{ marginTop: 4 }}>
            {events.slice(0, 4).map((e, i) => (
              <div key={i} className={classes.row} style={{ gridTemplateColumns: '14px 1fr' }}>
                <span className={classes.num}>{e.number}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.name}
                </span>
              </div>
            ))}
          </div>
        </Paper>
      </div>
    </div>
  );
}
