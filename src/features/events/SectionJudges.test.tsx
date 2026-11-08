// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useEvent } from '../../app/data';
import { db } from '../../db/db';
import * as repo from '../../db/repo';
import { danceEventDefaults } from '../../domain/segments';
import { SectionJudges } from './SectionJudges';

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
  return event ? <SectionJudges event={event} /> : null;
}

async function seed(withMarks: boolean) {
  const compId = await repo.createCompetition({ name: 'C', date: '', venue: '' });
  const eventId = await repo.createEvent(compId, {
    name: 'Novice',
    entryType: 'solo',
    compulsoryDanceIds: [],
    hasFreeDance: true,
    ...danceEventDefaults(),
  });
  const dances = await db.dances.where({ competitionId: compId }).toArray();
  await repo.updateEvent(eventId, { compulsoryDanceIds: [dances[0]!.id] });
  const skater = await repo.addSkater(compId, { name: 'Ann', club: 'A' });
  const entry = await repo.addEntry(eventId, { skaterIds: [skater] });
  const a = await repo.addJudge(compId, 'Anna Judge');
  const b = await repo.addJudge(compId, 'Bob Judge');
  await repo.updateEvent(eventId, { judgeIds: [a, b] });
  if (withMarks) await repo.setMark({ eventId, segmentKey: 'fd:A', judgeId: b, entryId: entry }, 57);
  return { compId, eventId, a, b, entry };
}

const renderCard = (eventId: string) =>
  render(
    <MantineProvider env="test">
      <Live id={eventId} />
    </MantineProvider>,
  );

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterEach(cleanup);

async function pick(label: RegExp | string, who: string) {
  fireEvent.click(await screen.findByLabelText(label));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getAllByLabelText(/Who judges from/)[0]!, { target: { value: who } });
  return dialog;
}

describe('SectionJudges', () => {
  it('is hidden for an event with one part', async () => {
    const { eventId } = await seed(false);
    await repo.updateEvent(eventId, { compulsoryDanceIds: [] });
    renderCard(eventId);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Judges by section')).toBeNull();
  });

  it('shows each seat’s judge for each part and changes one part when no marks are in the way', async () => {
    const { eventId, b } = await seed(false);
    renderCard(eventId);
    expect(await screen.findByText('Judges by section')).toBeTruthy();
    const dialog = await pick('Change who judges Free Dance in J2', 'Dora New');
    fireEvent.click(within(dialog).getByText('Change judge'));
    await waitFor(async () => expect((await db.events.get(eventId))!.judgeSwaps).toBeDefined());
    const ev = (await db.events.get(eventId))!;
    const dora = (await db.judges.toArray()).find((j) => j.name === 'Dora New');
    expect(ev.judgeSwaps).toEqual({ fd: { [b]: dora!.id } });
    expect(await screen.findByText('Dora New')).toBeTruthy();
  });

  it('asks what to do with marks already entered, and can give them to the new judge', async () => {
    const { eventId, b, entry } = await seed(true);
    renderCard(eventId);
    const dialog = await pick('Change who judges Free Dance in J2', 'Dora New');
    fireEvent.click(within(dialog).getByText('Change judge'));
    expect(await screen.findByText(/1 mark has already been entered/)).toBeTruthy();
    fireEvent.click(screen.getByText('Give them to the new judge'));
    await waitFor(async () => expect((await db.events.get(eventId))!.judgeSwaps).toBeDefined());
    const dora = (await db.judges.toArray()).find((j) => j.name === 'Dora New');
    expect((await db.marks.get([eventId, 'fd:A', dora!.id, entry]))?.tenths).toBe(57);
    expect(await db.marks.where({ judgeId: b }).count()).toBe(0);
  });

  it('can delete those marks instead', async () => {
    const { eventId } = await seed(true);
    renderCard(eventId);
    const dialog = await pick('Change who judges Free Dance in J2', 'Dora New');
    fireEvent.click(within(dialog).getByText('Change judge'));
    fireEvent.click(await screen.findByText('Delete them'));
    await waitFor(async () => expect((await db.events.get(eventId))!.judgeSwaps).toBeDefined());
    expect(await db.marks.count()).toBe(0);
  });

  it('cancelling leaves everything as it was', async () => {
    const { eventId } = await seed(true);
    renderCard(eventId);
    const dialog = await pick('Change who judges Free Dance in J2', 'Dora New');
    fireEvent.click(within(dialog).getByText('Change judge'));
    await screen.findByText(/has already been entered/);
    const asking = screen.getAllByRole('dialog').at(-1)!;
    fireEvent.click(within(asking).getByText('Cancel'));
    await new Promise((r) => setTimeout(r, 50));
    expect((await db.events.get(eventId))!.judgeSwaps).toBeUndefined();
    expect(await db.marks.count()).toBe(1);
  });

  it('will not seat a judge who already judges another seat in that part', async () => {
    const { eventId } = await seed(false);
    renderCard(eventId);
    const dialog = await pick('Change who judges Free Dance in J2', 'Anna Judge');
    expect(within(dialog).getByText(/already judges another seat in this part/)).toBeTruthy();
    expect((within(dialog).getByText('Change judge').closest('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('applies to the chosen part and every later one, and goes back to the seat’s own judge', async () => {
    const { eventId, b } = await seed(false);
    const ev = (await db.events.get(eventId))!;
    const dance = (await db.dances.get(ev.compulsoryDanceIds[0]!))!.name;
    renderCard(eventId);
    const dialog = await pick(`Change who judges ${dance} in J2`, 'Dora New');
    fireEvent.click(within(dialog).getByLabelText(/and every later part/));
    fireEvent.click(within(dialog).getByText('Change judge'));
    await waitFor(async () =>
      expect(Object.keys((await db.events.get(eventId))!.judgeSwaps ?? {})).toHaveLength(2),
    );
    const dora = (await db.judges.toArray()).find((j) => j.name === 'Dora New');
    expect((await db.events.get(eventId))!.judgeSwaps).toEqual({
      [ev.compulsoryDanceIds[0]! && `cd:${ev.compulsoryDanceIds[0]}`]: { [b]: dora!.id },
      fd: { [b]: dora!.id },
    });

    // Back to Bob for the free dance only.
    fireEvent.click(await screen.findByLabelText('Change who judges Free Dance in J2'));
    const back = (await screen.findAllByRole('dialog')).at(-1)!;
    fireEvent.click(within(back).getByText('Back to Bob Judge'));
    await waitFor(async () =>
      expect(Object.keys((await db.events.get(eventId))!.judgeSwaps ?? {})).toEqual([
        `cd:${ev.compulsoryDanceIds[0]}`,
      ]),
    );
  });
});
