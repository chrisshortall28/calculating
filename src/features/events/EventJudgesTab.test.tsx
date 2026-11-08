// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useEvent } from '../../app/data';
import { db } from '../../db/db';
import * as repo from '../../db/repo';
import { danceEventDefaults } from '../../domain/segments';
import { EventJudgesTab } from './EventJudgesTab';

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

/** Follows the stored event, as the event page does. */
function Live({ id }: { id: string }) {
  const event = useEvent(id);
  return event ? <EventJudgesTab event={event} /> : null;
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
  const skater = await repo.addSkater(compId, { name: 'Ann', club: 'A' });
  const entry = await repo.addEntry(eventId, { skaterIds: [skater] });
  const ann = await repo.addJudge(compId, 'Anna Judge');
  const bob = await repo.addJudge(compId, 'Bob Judge');
  await repo.updateEvent(eventId, { judgeIds: [ann, bob] });
  await repo.setMark({ eventId, segmentKey: 'fd:A', judgeId: bob, entryId: entry }, 57);
  return { compId, eventId, ann, bob, entry };
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

describe('EventJudgesTab judge changes', () => {
  it('renames a judge without touching their marks', async () => {
    const { eventId, bob } = await seed();
    renderTab(eventId);
    fireEvent.click(await screen.findByLabelText('Rename Bob Judge'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Robert Judge' } });
    fireEvent.click(within(dialog).getByText('Rename'));
    await waitFor(async () => expect((await db.judges.get(bob))?.name).toBe('Robert Judge'));
    expect(await db.marks.where({ judgeId: bob }).count()).toBe(1);
    expect((await screen.findAllByText('Robert Judge')).length).toBeGreaterThan(0);
  });

  it('does not allow a name another judge already has', async () => {
    const { eventId } = await seed();
    renderTab(eventId);
    fireEvent.click(await screen.findByLabelText('Rename Bob Judge'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'anna judge' } });
    expect(within(dialog).getByText('Another judge already has this name')).toBeTruthy();
    expect((within(dialog).getByText('Rename').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('changes a judge for the whole event, keeping their seat and marks', async () => {
    const { eventId, ann, bob } = await seed();
    renderTab(eventId);
    fireEvent.click(await screen.findByLabelText('Change Bob Judge to another judge'));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/the 1 mark entered so far become theirs/)).toBeTruthy();
    fireEvent.change(within(dialog).getAllByLabelText('New judge')[0]!, { target: { value: 'Carla New' } });
    fireEvent.click(within(dialog).getByText('Change judge'));

    await waitFor(async () => expect((await db.events.get(eventId))!.judgeIds[0]).toBe(ann));
    const ev = (await db.events.get(eventId))!;
    const carla = await db.judges.get(ev.judgeIds[1]!);
    expect(carla?.name).toBe('Carla New');
    expect(ev.judgeIds[1]).not.toBe(bob);
    expect(await db.marks.where({ judgeId: bob }).count()).toBe(0);
    expect(await db.marks.where({ judgeId: carla!.id }).count()).toBe(1);
  });

  it('will not change to a judge who is already judging the event', async () => {
    const { eventId } = await seed();
    renderTab(eventId);
    fireEvent.click(await screen.findByLabelText('Change Bob Judge to another judge'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getAllByLabelText('New judge')[0]!, { target: { value: 'Anna Judge' } });
    expect(within(dialog).getByText('Anna Judge is already judging this event')).toBeTruthy();
    expect((within(dialog).getByText('Change judge').closest('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
