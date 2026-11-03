// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EventDetailsForm } from './EventDetailsForm';

// jsdom lacks these, which Mantine's colour scheme and scroll areas use.
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
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Element.prototype.scrollIntoView ??= () => {};

afterEach(cleanup);

describe('EventDetailsForm', () => {
  it('has no compulsory figures for a Pairs event', () => {
    render(
      <MantineProvider env="test">
        <EventDetailsForm competitionId="c" submitLabel="Add" onSubmit={() => {}} />
      </MantineProvider>,
    );
    fireEvent.click(screen.getByText('Figures & Free'));
    fireEvent.click(screen.getByText('Add figure'));
    expect(screen.getAllByLabelText('Figure 1').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Pairs'));
    expect(screen.queryAllByLabelText('Figure 1')).toHaveLength(0);
    expect(screen.queryByText('Add figure')).toBeNull();
    expect(screen.getByText('Pairs events have no compulsory figures')).toBeTruthy();

    fireEvent.click(screen.getByText('Single'));
    expect(screen.getByText('Add figure')).toBeTruthy();
  });
});
