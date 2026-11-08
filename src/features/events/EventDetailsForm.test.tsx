// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createCompetition, createEvent } from '../../db/repo';
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

  it('warns when the name matches another event in the competition, but not the event being edited', async () => {
    const compId = await createCompetition({
      name: 'C',
      date: '',
      venue: '',
      primaryColor: '#000000',
      secondaryColor: '#000000',
      welcome: '',
    });
    const evId = await createEvent(compId, {
      name: 'Novice Ladies',
      entryType: 'single',
      discipline: 'dance',
      compulsoryDanceIds: [],
      hasFreeDance: true,
      figures: [],
      hasShort: false,
      hasLong: false,
      factors: { figures: 0, short: 0, long: 0 },
    });
    const warning = 'Another event in this competition already has this name.';
    const ui = (id?: string) => (
      <MantineProvider env="test">
        <EventDetailsForm competitionId={compId} eventId={id} submitLabel="Add" onSubmit={() => {}} />
      </MantineProvider>
    );
    const { rerender } = render(ui());
    fireEvent.change(screen.getByLabelText(/Event name/), { target: { value: ' novice ladies ' } });
    expect(await screen.findByText(warning)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Event name/), { target: { value: 'Novice Men' } });
    expect(screen.queryByText(warning)).toBeNull();

    rerender(ui(evId));
    fireEvent.change(screen.getByLabelText(/Event name/), { target: { value: 'Novice Ladies' } });
    expect(screen.queryByText(warning)).toBeNull();
  });
});
