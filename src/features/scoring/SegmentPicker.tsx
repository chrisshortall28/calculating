import { IconCheck } from '@tabler/icons-react';
import classes from './SegmentPicker.module.css';

export interface PickerSegment {
  id: string;
  name: string;
  /** marks entered / marks expected */
  done: number;
  total: number;
  complete: boolean;
}

/** Folder tabs for choosing the dance, figure, programme or judge being scored, each with a progress count. */
export function SegmentPicker({
  segments,
  value,
  onChange,
}: {
  segments: PickerSegment[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className={classes.row} role="tablist">
      {segments.map((s) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-selected={s.id === value}
          data-active={s.id === value || undefined}
          className={classes.tab}
          onClick={() => onChange(s.id)}
        >
          <span className={classes.name}>{s.name}</span>
          <span className={classes.pill} data-complete={s.complete || undefined}>
            {s.complete && <IconCheck size={13} stroke={3} />}
            {s.done}/{s.total}
          </span>
        </button>
      ))}
    </div>
  );
}
