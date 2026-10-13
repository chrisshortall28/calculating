import { Text } from '@mantine/core';
import { Fragment, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { markKeyLabel, type Segment } from '../domain/segments';
import type { Id, SegmentKey } from '../domain/types';
import { formatSum } from '../scoring';
import { arrowCell, stepCell, type Cell, type Direction } from './gridNav';
import type { GridRow } from './MarkGrid';
import { MarkCell, type NavIntent } from './MarkCell';
import classes from './MarkGrid.module.css';

interface Props {
  rows: GridRow[];
  entryLabel?: string;
  judgeId: Id;
  /** 1-based position of the judge on the panel, for cell labels */
  judgeNo: number;
  segments: Segment[];
  getValue: (key: SegmentKey, judgeId: Id, entryId: Id) => number | undefined;
  onCommit: (key: SegmentKey, judgeId: Id, entryId: Id, tenths: number | null) => void;
  /** entryId -> the judge's factored sum for the event (thousandths); only entries with all marks in */
  sums: Map<Id, number>;
  /** entryId -> the judge's ranking of the entry; undefined until all of the judge's marks are in */
  ranks: Map<Id, number> | undefined;
  direction: Direction;
  autoAdvance: boolean;
  readOnly: boolean;
  numberPad?: boolean;
  focusedInputRef?: RefObject<HTMLInputElement | null>;
  /** changes to this value re-focus the first empty cell (e.g. switching judge) */
  focusKey?: string;
}

/**
 * One judge's marks laid out like the judge's sheet: a row per entry, a column per dance, figure or
 * programme mark, then the row's total and the judge's ranking of the entry.
 */
export function JudgeGrid(props: Props) {
  const {
    rows,
    entryLabel = 'Entry',
    judgeId,
    judgeNo,
    segments,
    getValue,
    onCommit,
    sums,
    ranks,
    direction,
    autoAdvance,
    readOnly,
    numberPad,
    focusedInputRef,
    focusKey,
  } = props;
  const columns = segments.flatMap((s) => s.markKeys.map((key) => ({ key, segment: s })));
  const cols = columns.length;
  const refs = useRef(new Map<string, HTMLInputElement>());
  const [active, setActive] = useState<Cell | null>(null);

  const focusCell = useCallback((cell: Cell | null) => {
    if (cell) refs.current.get(`${cell.row}:${cell.col}`)?.focus();
  }, []);

  // Focus the first empty cell when the judge changes or the grid is shown.
  useEffect(() => {
    if (readOnly || rows.length === 0 || cols === 0) return;
    let cell: Cell | null = { row: 0, col: 0 };
    while (cell) {
      if (getValue(columns[cell.col]!.key, judgeId, rows[cell.row]!.id) === undefined) break;
      cell = stepCell(cell, direction, rows.length, cols, false, 1);
    }
    focusCell(cell ?? { row: 0, col: 0 });
    // Only on judge change / mount — not on every mark update.
  }, [focusKey]);

  const navigate = (from: Cell, intent: NavIntent) => {
    if (intent === 'next' || intent === 'prev') {
      focusCell(stepCell(from, direction, rows.length, cols, intent === 'prev', 1));
    } else {
      focusCell(arrowCell(from, intent, rows.length, cols));
    }
  };

  if (rows.length === 0) return <Text c="dimmed">Add entries to this event to start entering marks.</Text>;

  const multi = segments.some((s) => s.markKeys.length > 1);

  return (
    <div className={classes.wrap}>
      <table className={`${classes.table} ${classes.roomy}`}>
        <thead>
          <tr>
            <th className={classes.startNo} rowSpan={multi ? 2 : 1}>
              #
            </th>
            <th className={classes.entryCell} rowSpan={multi ? 2 : 1}>
              {entryLabel}
            </th>
            {segments.map((s) => (
              <th
                key={s.id}
                colSpan={s.markKeys.length}
                rowSpan={multi && s.markKeys.length === 1 ? 2 : 1}
                className={classes.judgeStart}
                title={s.name}
              >
                {s.name}
              </th>
            ))}
            <th className={classes.judgeStart} rowSpan={multi ? 2 : 1}>
              Total
            </th>
            <th className={classes.judgeStart} rowSpan={multi ? 2 : 1}>
              Rank
            </th>
          </tr>
          {multi && (
            <tr>
              {segments
                .filter((s) => s.markKeys.length > 1)
                .map((s) => (
                  <Fragment key={s.id}>
                    {s.markKeys.map((k, ki) => (
                      <th key={k} className={ki === 0 ? classes.judgeStart : undefined}>
                        {markKeyLabel(k)}
                      </th>
                    ))}
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
              {columns.map(({ key, segment }, col) => {
                const cell = { row: r, col };
                const part = markKeyLabel(key);
                return (
                  <td key={key} className={segment.markKeys[0] === key ? classes.judgeStart : undefined}>
                    <MarkCell
                      value={getValue(key, judgeId, row.id)}
                      readOnly={readOnly}
                      autoAdvance={autoAdvance}
                      inputMode={numberPad ? 'none' : 'decimal'}
                      label={`${row.label}, judge ${judgeNo}, ${segment.name}${part ? ` ${part}` : ''}`}
                      inputRef={(el) => {
                        const id = `${r}:${col}`;
                        if (el) refs.current.set(id, el);
                        else refs.current.delete(id);
                      }}
                      onCommit={(t) => onCommit(key, judgeId, row.id, t)}
                      onNavigate={(intent) => navigate(cell, intent)}
                      onFocus={() => {
                        setActive(cell);
                        if (focusedInputRef)
                          focusedInputRef.current = refs.current.get(`${r}:${col}`) ?? null;
                      }}
                    />
                  </td>
                );
              })}
              <td className={classes.judgeStart}>{sums.has(row.id) ? formatSum(sums.get(row.id)!) : ''}</td>
              <td className={`${classes.judgeStart} ${classes.rank}`}>{ranks?.get(row.id) ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
