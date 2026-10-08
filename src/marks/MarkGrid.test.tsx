// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { SegmentKey } from '../domain/types';
import { MarkGrid } from './MarkGrid';
import { NumberPad } from './NumberPad';

afterEach(cleanup);

// jsdom lacks matchMedia, which Mantine's colour-scheme handling uses.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

type Commit = [SegmentKey, string, string, number | null];

/** A grid backed by in-memory state, recording every commit in order. */
function Harness({
  commits,
  autoAdvance = true,
  pad = false,
}: {
  commits: Commit[];
  autoAdvance?: boolean;
  pad?: boolean;
}) {
  const [marks, setMarks] = useState(new Map<string, number>());
  const focused = useRef<HTMLInputElement | null>(null);
  return (
    <MantineProvider>
      <MarkGrid
        rows={[
          { id: 'amy', label: 'Amy' },
          { id: 'beth', label: 'Beth' },
          { id: 'cara', label: 'Cara' },
        ]}
        judges={[{ id: 'j1', name: 'Judge' }]}
        markKeys={['cd:w']}
        getValue={(k, j, e) => marks.get(`${k}|${j}|${e}`)}
        onCommit={(k, j, e, t) => {
          commits.push([k, j, e, t]);
          setMarks((m) => {
            const next = new Map(m);
            if (t === null) next.delete(`${k}|${j}|${e}`);
            else next.set(`${k}|${j}|${e}`, t);
            return next;
          });
        }}
        direction="down"
        autoAdvance={autoAdvance}
        readOnly={false}
        focusKey="seg"
        numberPad={pad}
        focusedInputRef={focused}
      />
      {pad && <NumberPad targetRef={focused} />}
    </MantineProvider>
  );
}

const cell = (name: string) => screen.getByLabelText(`${name}, judge 1`) as HTMLInputElement;

/** Types into the focused cell one character at a time, as a keyboard would. */
function type(text: string) {
  for (const ch of text) {
    const el = document.activeElement as HTMLInputElement;
    act(() => {
      fireEvent.change(el, {
        target: { value: el.value.slice(0, el.selectionStart ?? el.value.length) + ch },
      });
    });
  }
}

/** Taps a number pad key: mouse down (which must not steal focus), then click. */
function tap(name: string) {
  const button = screen.getByRole('button', { name });
  act(() => {
    fireEvent.mouseDown(button);
    fireEvent.click(button);
  });
}

function press(key: string) {
  act(() => {
    fireEvent.keyDown(document.activeElement!, { key });
  });
}

describe('MarkGrid entry', () => {
  it('auto-advance saves "57" as 5.7, not 5.0', () => {
    const commits: Commit[] = [];
    render(<Harness commits={commits} />);
    expect(document.activeElement).toBe(cell('Amy'));

    type('57');

    expect(commits).toEqual([['cd:w', 'j1', 'amy', 57]]);
    expect(cell('Amy').value).toBe('5.7');
    expect(document.activeElement).toBe(cell('Beth'));
  });

  it('keeps every value when typing a whole column quickly', () => {
    const commits: Commit[] = [];
    render(<Harness commits={commits} />);

    type('57');
    type('62');
    type('10');

    expect(commits.map((c) => [c[2], c[3]])).toEqual([
      ['amy', 57],
      ['beth', 62],
      ['cara', 10],
    ]);
    expect([cell('Amy').value, cell('Beth').value, cell('Cara').value]).toEqual(['5.7', '6.2', '1.0']);
  });

  it('"10" is 1.0; a full 10.0 is "100" with auto-advance off', () => {
    const commits: Commit[] = [];
    render(<Harness commits={commits} autoAdvance={false} />);

    type('10');
    press('Enter');
    type('100');
    press('Enter');

    expect(commits.map((c) => [c[2], c[3]])).toEqual([
      ['amy', 10],
      ['beth', 100],
    ]);
  });

  it('Enter commits once and moves on', () => {
    const commits: Commit[] = [];
    render(<Harness commits={commits} autoAdvance={false} />);

    type('5');
    press('Enter');
    type('4.5');
    press('Enter');

    expect(commits.map((c) => [c[2], c[3]])).toEqual([
      ['amy', 50],
      ['beth', 45],
    ]);
    expect(document.activeElement).toBe(cell('Cara'));
  });

  it('clicking into a filled cell selects it, so typing replaces the value', () => {
    const commits: Commit[] = [];
    render(<Harness commits={commits} />);
    type('52'); // Amy = 5.2, focus moves to Beth

    act(() => {
      fireEvent.mouseDown(cell('Amy'));
    });
    expect(document.activeElement).toBe(cell('Amy'));
    expect([cell('Amy').selectionStart, cell('Amy').selectionEnd]).toEqual([0, 3]);

    type('57');
    expect(commits.map((c) => [c[2], c[3]])).toEqual([
      ['amy', 52],
      ['amy', 57],
    ]);
  });

  it('clicking the already-focused cell also selects its value', () => {
    const commits: Commit[] = [];
    render(<Harness commits={commits} />);
    type('52');
    act(() => cell('Amy').focus());
    act(() => cell('Amy').setSelectionRange(2, 2)); // caret parked inside "5.2"

    act(() => {
      fireEvent.mouseDown(cell('Amy'));
    });
    expect([cell('Amy').selectionStart, cell('Amy').selectionEnd]).toEqual([0, 3]);
  });

  it('leaving a cell by clicking elsewhere still saves the typed value', () => {
    const commits: Commit[] = [];
    render(<Harness commits={commits} autoAdvance={false} />);

    type('4');
    act(() => cell('Cara').focus());

    expect(commits.map((c) => [c[2], c[3]])).toEqual([['amy', 40]]);
    expect(cell('Amy').value).toBe('4.0');
  });

  describe('number pad', () => {
    it('keys in "57" like the keyboard and advances', () => {
      const commits: Commit[] = [];
      render(<Harness commits={commits} pad />);

      tap('5');
      expect(cell('Amy').value).toBe('5');
      tap('7');

      expect(commits).toEqual([['cd:w', 'j1', 'amy', 57]]);
      expect(document.activeElement).toBe(cell('Beth'));
    });

    it('takes a decimal point, Enter and Backspace', () => {
      const commits: Commit[] = [];
      render(<Harness commits={commits} autoAdvance={false} pad />);

      tap('4');
      tap('.');
      tap('5');
      tap('9');
      tap('Backspace');
      tap('Enter');
      tap('7');
      tap('Enter');

      expect(commits.map((c) => [c[2], c[3]])).toEqual([
        ['amy', 45],
        ['beth', 70],
      ]);
      expect(document.activeElement).toBe(cell('Cara'));
    });

    it('replaces an existing mark and clears it with Backspace', () => {
      const commits: Commit[] = [];
      render(<Harness commits={commits} pad />);
      type('52');

      act(() => {
        fireEvent.mouseDown(cell('Amy'));
      });
      tap('6');
      tap('1');
      act(() => {
        fireEvent.mouseDown(cell('Amy'));
      });
      tap('Backspace');
      tap('Enter');

      expect(commits.map((c) => [c[2], c[3]])).toEqual([
        ['amy', 52],
        ['amy', 61],
        ['amy', null],
      ]);
    });
  });
});
