import { Button, Paper, SimpleGrid } from '@mantine/core';
import { IconBackspace, IconCornerDownLeft } from '@tabler/icons-react';
import type { RefObject } from 'react';
import classes from './NumberPad.module.css';

/** Sets an input's value the way typing would, so React's onChange runs. */
function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Applies a pad key to a mark cell as if it had been typed there. */
export function pressPadKey(input: HTMLInputElement, key: string) {
  input.focus();
  if (key === 'Enter') {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    return;
  }
  // A freshly focused cell has its whole value selected, so the first key replaces it.
  const replacing =
    input.value !== '' && input.selectionStart === 0 && input.selectionEnd === input.value.length;
  const base = replacing ? '' : input.value;
  setInputValue(input, key === 'Backspace' ? base.slice(0, -1) : base + key);
}

const LAYOUT: { key: string; label?: string; span?: number }[] = [
  ...['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((key) => ({ key })),
  { key: '0', span: 2 },
  { key: '.' },
];

/**
 * On-screen number pad for entering marks by mouse or touch. Keys act on the mark cell that last had
 * focus; they don't take focus themselves, so the cell keeps its draft and (on tablets) the system
 * keyboard stays away.
 */
export function NumberPad({
  targetRef,
  disabled,
}: {
  targetRef: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
}) {
  const press = (key: string) => {
    const input = targetRef.current;
    if (input?.isConnected) pressPadKey(input, key);
  };
  // Stop the press moving focus out of the cell (and so committing its half-typed mark).
  const keep = (e: React.MouseEvent) => e.preventDefault();

  return (
    <Paper withBorder shadow="sm" p="sm" className={classes.pad} role="group" aria-label="Number pad">
      <SimpleGrid cols={3} spacing="sm">
        {LAYOUT.map(({ key, span }) => (
          <Button
            key={key}
            variant="default"
            className={classes.key}
            style={span ? { gridColumn: `span ${span}` } : undefined}
            disabled={disabled}
            onMouseDown={keep}
            onClick={() => press(key)}
          >
            {key}
          </Button>
        ))}
        <Button
          variant="default"
          className={classes.key}
          aria-label="Backspace"
          disabled={disabled}
          onMouseDown={keep}
          onClick={() => press('Backspace')}
        >
          <IconBackspace size={30} />
        </Button>
        <Button
          variant="light"
          className={classes.key}
          style={{ gridColumn: 'span 2' }}
          aria-label="Enter"
          disabled={disabled}
          onMouseDown={keep}
          onClick={() => press('Enter')}
        >
          <IconCornerDownLeft size={30} />
        </Button>
      </SimpleGrid>
    </Paper>
  );
}
