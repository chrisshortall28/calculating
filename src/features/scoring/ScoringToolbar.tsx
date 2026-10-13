import { Button, Switch } from '@mantine/core';
import { IconEraser, IconLock, IconLockOpen } from '@tabler/icons-react';
import type { Direction } from '../../marks/gridNav';
import classes from './ScoringToolbar.module.css';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type ScoringView = 'dance' | 'judge';

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className={classes.segmented} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={classes.segment}
          aria-pressed={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={classes.chip} data-disabled={disabled || undefined}>
      <Switch
        size="xs"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      {label}
    </label>
  );
}

/** The scoring options and actions, the same for every event. */
export function ScoringToolbar(props: {
  /** what the event's parts are called, lower case: dance, figure, programme or section */
  noun: string;
  /** what the event's entries are called, lower case, singular: skater, duo, couple, team, pair */
  entryNoun: string;
  view: ScoringView;
  onView: (v: ScoringView) => void;
  direction: Direction;
  onDirection: (d: Direction) => void;
  autoAdvance: boolean;
  onAutoAdvance: (v: boolean) => void;
  numberPad: boolean;
  onNumberPad: (v: boolean) => void;
  locked: boolean;
  canClear: boolean;
  onClear: () => void;
  onToggleLock: () => void;
}) {
  const { view, locked } = props;
  return (
    <div className={classes.toolbar}>
      <div className={classes.group}>
        <span className={classes.label}>View by</span>
        <Segmented
          label="View by"
          value={view}
          onChange={props.onView}
          options={[
            { value: 'dance', label: cap(props.noun) },
            { value: 'judge', label: 'Judge' },
          ]}
        />
      </div>
      <div className={classes.group} data-disabled={locked || undefined}>
        <span className={classes.label}>Fill order</span>
        <Segmented
          label="Fill order"
          value={props.direction}
          onChange={props.onDirection}
          disabled={locked}
          options={[
            {
              value: 'down',
              label: view === 'judge' ? `↓ ${cap(props.noun)} by ${props.noun}` : '↓ Judge by judge',
            },
            { value: 'across', label: `→ ${cap(props.entryNoun)} by ${props.entryNoun}` },
          ]}
        />
      </div>
      <div className={classes.group} data-disabled={locked || undefined}>
        <span className={classes.label}>Input</span>
        <div className={classes.controls}>
          <Chip
            label="Auto-advance"
            checked={props.autoAdvance}
            onChange={props.onAutoAdvance}
            disabled={locked}
          />
          <Chip label="Number pad" checked={props.numberPad} onChange={props.onNumberPad} disabled={locked} />
        </div>
      </div>
      <div className={classes.actions}>
        <Button
          variant="default"
          size="md"
          leftSection={<IconEraser size={16} />}
          disabled={locked || !props.canClear}
          onClick={props.onClear}
        >
          Clear marks
        </Button>
        <Button
          size="md"
          color="green"
          variant={locked ? 'transparent' : 'filled'}
          className={locked ? classes.unlock : undefined}
          leftSection={locked ? <IconLockOpen size={16} /> : <IconLock size={16} />}
          onClick={props.onToggleLock}
        >
          {locked ? 'Unlock' : 'Mark final'}
        </Button>
      </div>
    </div>
  );
}
