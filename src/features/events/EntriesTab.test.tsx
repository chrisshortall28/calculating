// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useEvent } from '../../app/data';
import { db } from '../../db/db';
import * as repo from '../../db/repo';
import { danceEventDefaults } from '../../domain/segments';
import { EntriesTab } from './EntriesTab';

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
  return event ? <EntriesTab event={event} /> : null;
}

async function seed() {
  const compId = await repo.createCompetition({ name: 'C', date: '', venue: '' });
  const eventId = await repo.createEvent(compId, {
    name: 'Novice',
    entryType: 'solo',
    compulsoryDanceIds: [],
    hasFreeDance: true,
    ...danceEventDefaults(),
  });
  for (const name of ['Ann', 'Bea']) {
    const s = await repo.addSkater(compId, { name, club: 'A' });
    await repo.addEntry(eventId, { skaterIds: [s] });
  }
  return eventId;
}

const renderTab = (eventId: string) =>
  render(
    <MantineProvider env="test">
      <ModalsProvider>
        <Live id={eventId} />
      </ModalsProvider>
    </MantineProvider>,
  );

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterEach(cleanup);

describe('EntriesTab when the event is final', () => {
  it('can be edited while the event is still being scored', async () => {
    renderTab(await seed());
    await screen.findByText('Randomise order');
    expect(screen.queryByText(/marked final/)).toBeNull();
    for (const c of await screen.findAllByLabelText('Remove entry'))
      expect(c.matches(':disabled')).toBe(false);
  });

  it('says so and disables adding, reordering, editing and removing skaters', async () => {
    const eventId = await seed();
    await repo.setEventStatus(eventId, 'final');
    renderTab(eventId);
    expect(await screen.findByText(/marked final, so its skaters can’t be changed/)).toBeTruthy();
    for (const label of ['Edit entry', 'Remove entry', 'Move down', 'Drag to reorder']) {
      const controls = await screen.findAllByLabelText(label);
      expect(controls.length, label).toBeGreaterThan(0);
      for (const c of controls) expect(c.matches(':disabled'), label).toBe(true);
    }
    for (const text of ['Randomise order', 'Reverse order by results', 'Paste list', 'Add']) {
      expect((screen.getByText(text).closest('button') as HTMLButtonElement).matches(':disabled'), text).toBe(
        true,
      );
    }
    const boxes = [...document.querySelectorAll('input, textarea')];
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every((t) => t.matches(':disabled'))).toBe(true);
  });
});
