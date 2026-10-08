import { Text, UnstyledButton } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import classes from './SegmentPicker.module.css';

export interface PickerSegment {
  id: string;
  name: string;
  /** marks entered / marks expected for this dance, 0–1 */
  progress: number;
  complete: boolean;
}

/** Buttons for choosing the dance/figure/programme being scored, each with its progress along the bottom edge. */
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
        <UnstyledButton
          key={s.id}
          role="tab"
          aria-selected={s.id === value}
          data-active={s.id === value || undefined}
          className={classes.button}
          onClick={() => onChange(s.id)}
        >
          <span className={classes.label}>
            {s.complete && <IconCheck size={16} color="var(--mantine-color-green-6)" />}
            <Text span fw={600}>
              {s.name}
            </Text>
          </span>
          <span className={classes.track} aria-hidden>
            <span
              className={classes.fill}
              data-complete={s.complete || undefined}
              style={{ width: `${Math.round(s.progress * 100)}%` }}
            />
          </span>
        </UnstyledButton>
      ))}
    </div>
  );
}
