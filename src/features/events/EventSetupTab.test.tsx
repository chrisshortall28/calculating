// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useEvent } from '../../app/data';
import { db } from '../../db/db';
import * as repo from '../../db/repo';
import { danceEventDefaults } from '../../domain/segments';
import { EventSetupTab } from './EventSetupTab';

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

function Live({ id }: { id: string }) {
  const event = useEvent(id);
  return event ? <EventSetupTab event={event} /> : null;
}

async function seed(final: boolean) {
  const compId = await repo.createCompetition({ name: 'C', date: '', venue: '' });
  const dances = await db.dances.where({ competitionId: compId }).toArray();
  const eventId = await repo.createEvent(compId, {
    name: 'Novice',
    entryType: 'solo',
    compulsoryDanceIds: [dances[0]!.id],
    hasFreeDance: true,
    ...danceEventDefaults(),
  });
  if (final) await repo.setEventStatus(eventId, 'final');
  return eventId;
}

const renderTab = (eventId: string) =>
  render(
    <MantineProvider env="test">
      <ModalsProvider>
        <MemoryRouter>
          <Live id={eventId} />
        </MemoryRouter>
      </ModalsProvider>
    </MantineProvider>,
  );

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterEach(cleanup);

describe('EventSetupTab when the event is final', () => {
  it('leaves only the name, and saving, available', async () => {
    renderTab(await seed(true));
    expect(await screen.findByText(/only its name can be changed/)).toBeTruthy();
    const name = screen.getByLabelText(/Event name/) as HTMLInputElement;
    expect(name.matches(':disabled')).toBe(false);
    expect((screen.getByText('Save').closest('button') as HTMLButtonElement).matches(':disabled')).toBe(
      false,
    );
    const others = [...document.querySelectorAll('input, button, textarea')].filter(
      (e) => e !== name && !e.closest('[role=dialog]') && e.textContent?.trim() !== 'Save',
    );
    expect(others.length).toBeGreaterThan(3);
    expect(others.every((e) => e.matches(':disabled'))).toBe(true);
    expect(
      (screen.getByText('Delete event').closest('button') as HTMLButtonElement).matches(':disabled'),
    ).toBe(true);
  });

  it('saves a new name and nothing else', async () => {
    const eventId = await seed(true);
    const before = (await db.events.get(eventId))!;
    renderTab(eventId);
    fireEvent.change(await screen.findByLabelText(/Event name/), { target: { value: 'Novice Ladies' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(async () => expect((await db.events.get(eventId))!.name).toBe('Novice Ladies'));
    expect(await db.events.get(eventId)).toEqual({ ...before, name: 'Novice Ladies' });
  });

  it('is fully editable while the event is not final', async () => {
    renderTab(await seed(false));
    await screen.findByLabelText(/Event name/);
    expect(screen.queryByText(/only its name can be changed/)).toBeNull();
    expect([...document.querySelectorAll('fieldset input')].every((e) => !e.matches(':disabled'))).toBe(true);
    expect(
      (screen.getByText('Delete event').closest('button') as HTMLButtonElement).matches(':disabled'),
    ).toBe(false);
  });
});
