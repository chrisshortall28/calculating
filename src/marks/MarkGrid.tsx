import { Text } from '@mantine/core';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { Id, SegmentKey } from '../domain/types';
import { markKeyLabel } from '../domain/segments';
import { arrowCell, stepCell, type Cell, type Direction } from './gridNav';
import { MarkCell, type NavIntent } from './MarkCell';
import classes from './MarkGrid.module.css';

export interface GridRow {
  id: Id;
  label: string;
  sub?: string;
}

export interface GridJudge {
  id: Id;
  name: string;
}

interface Props {
  rows: GridRow[];
  /** Heading for the rows' column, e.g. "Skater" (default "Entry"). */
  entryLabel?: string;
  judges: GridJudge[];
  markKeys: SegmentKey[];
  getValue: (key: SegmentKey, judgeId: Id, entryId: Id) => number | undefined;
  onCommit: (key: SegmentKey, judgeId: Id, entryId: Id, tenths: number | null) => void;
  /** judgeId -> entryId -> ordinal, shown beside each judge's marks */
  ordinals?: Map<Id, Map<Id, number>>;
  direction: Direction;
  autoAdvance: boolean;
  readOnly: boolean;
  /** changes to this value re-focus the first empty cell (e.g. switching segment) */
  focusKey?: string;
}

/**
 * Spreadsheet-style mark entry. Rows are entries in start order; each judge has one column per
 * mark key (one for a compulsory dance, A and B for the free dance).
 */
export function MarkGrid(props: Props) {
  const {
    rows,
    entryLabel = 'Entry',
    judges,
    markKeys,
    getValue,
    onCommit,
    ordinals,
    direction,
    autoAdvance,
    readOnly,
    focusKey,
  } = props;
  const cols = judges.length * markKeys.length;
  const refs = useRef(new Map<string, HTMLInputElement>());
  const [active, setActive] = useState<Cell | null>(null);

  const colInfo = (col: number) => ({
    judge: judges[Math.floor(col / markKeys.length)]!,
    key: markKeys[col % markKeys.length]!,
  });

  const focusCell = useCallback((cell: Cell | null) => {
    if (cell) refs.current.get(`${cell.row}:${cell.col}`)?.focus();
  }, []);

  // Focus the first empty cell (in entry order) when the grid is shown or the segment changes.
  useEffect(() => {
    if (readOnly || rows.length === 0 || cols === 0) return;
    let cell: Cell | null = { row: 0, col: 0 };
    while (cell) {
      const { judge, key } = colInfo(cell.col);
      if (getValue(key, judge.id, rows[cell.row]!.id) === undefined) break;
      cell = stepCell(cell, direction, rows.length, cols, false, markKeys.length);
    }
    focusCell(cell ?? { row: 0, col: 0 });
    // Only on segment change / mount — not on every mark update.
  }, [focusKey]);

  const navigate = (from: Cell, intent: NavIntent) => {
    if (intent === 'next' || intent === 'prev') {
      focusCell(stepCell(from, direction, rows.length, cols, intent === 'prev', markKeys.length));
    } else {
      focusCell(arrowCell(from, intent, rows.length, cols));
    }
  };

  if (judges.length === 0) {
    return <Text c="dimmed">Add judges to this event’s panel to start entering marks.</Text>;
  }
  if (rows.length === 0) {
    return <Text c="dimmed">Add entries to this event to start entering marks.</Text>;
  }

  const multi = markKeys.length > 1;
  // With one mark per judge the ordinal sits inside the mark's cell (padded equally on both sides), so
  // the box is centred under the judge heading rather than off to one side of a separate ordinal column.
  const ordinalCol = !!ordinals && multi;
  const activeJudge = active ? Math.floor(active.col / markKeys.length) : -1;

  return (
    <div className={classes.wrap}>
      <table className={classes.table}>
        <thead>
          <tr>
            <th className={classes.startNo} rowSpan={multi ? 2 : 1}>
              #
            </th>
            <th className={classes.entryCell} rowSpan={multi ? 2 : 1}>
              {entryLabel}
            </th>
            {judges.map((j, ji) => (
              <th
                key={j.id}
                colSpan={markKeys.length + (ordinalCol ? 1 : 0)}
                className={`${classes.judgeStart} ${ji === activeJudge ? classes.activeCol : ''}`}
                title={j.name}
              >
                J{ji + 1}{' '}
                <Text span size="xs" c="dimmed" fw={400}>
                  {j.name}
                </Text>
              </th>
            ))}
          </tr>
          {multi && (
            <tr>
              {judges.map((j, ji) => (
                <Fragment key={j.id}>
                  {markKeys.map((k, ki) => (
                    <th
                      key={k}
                      className={`${ki === 0 ? classes.judgeStart : ''} ${active?.col === ji * markKeys.length + ki ? classes.activeCol : ''}`}
                    >
                      {markKeyLabel(k)}
                    </th>
                  ))}
                  {ordinalCol && <th className={classes.ordinal}>pl</th>}
                </Fragment>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={row.id} className={active?.row === r ? classes.activeRow : undefined}>
              <td className={classes.startNo}>{r + 1}</td>
              <td className={classes.entryCell} title={row.sub ? `${row.label} — ${row.sub}` : row.label}>
                <Text size="sm" fw={500} truncate>
                  {row.label}
                </Text>
                {row.sub && (
                  <Text size="xs" c="dimmed" truncate>
                    {row.sub}
                  </Text>
                )}
              </td>
              {judges.map((j, ji) => (
                <Fragment key={j.id}>
                  {markKeys.map((key, ki) => {
                    const col = ji * markKeys.length + ki;
                    const cell = { row: r, col };
                    return (
                      <td
                        key={key}
                        className={`${ki === 0 ? classes.judgeStart : ''} ${ordinals && !multi ? classes.withOrdinal : ''}`}
                      >
                        <MarkCell
                          value={getValue(key, j.id, row.id)}
                          readOnly={readOnly}
                          autoAdvance={autoAdvance}
                          label={`${row.label}, judge ${ji + 1}${multi ? ` ${markKeyLabel(key)}` : ''}`}
                          inputRef={(el) => {
                            const id = `${r}:${col}`;
                            if (el) refs.current.set(id, el);
                            else refs.current.delete(id);
                          }}
                          onCommit={(t) => onCommit(key, j.id, row.id, t)}
                          onNavigate={(intent) => navigate(cell, intent)}
                          onFocus={() => setActive(cell)}
                        />
                        {ordinals && !multi && (
                          <span className={`${classes.ordinal} ${classes.inlineOrdinal}`}>
                            {ordinals.get(j.id)?.get(row.id) ?? ''}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {ordinalCol && <td className={classes.ordinal}>{ordinals.get(j.id)?.get(row.id) ?? ''}</td>}
                </Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
