// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import * as repo from '../../db/repo';
import { danceEventDefaults } from '../../domain/segments';
import type { CompEvent } from '../../domain/types';

const actions = vi.hoisted(() => ({
  printSkatingOrder: vi.fn(async () => {}),
  printJudgeSheets: vi.fn(async () => {}),
  printResults: vi.fn(async () => ({ complete: 1, total: 1 })),
}));
vi.mock('../../pdf/actions', () => actions);

import { EventPdfModal } from './EventPdfModal';

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

async function seed() {
  const compId = await repo.createCompetition({ name: 'C', date: '', venue: '', rotateStartOrder: true });
  const dances = await db.dances.where({ competitionId: compId }).toArray();
  const eventId = await repo.createEvent(compId, {
    name: 'Novice',
    entryType: 'solo',
    compulsoryDanceIds: [dances[0]!.id, dances[1]!.id],
    hasFreeDance: true,
    ...danceEventDefaults(),
  });
  for (const name of ['Ann', 'Bea', 'Cat', 'Dee']) {
    const s = await repo.addSkater(compId, { name, club: 'A' });
    await repo.addEntry(eventId, { skaterIds: [s] });
  }
  const judge = await repo.addJudge(compId, 'Judge');
  await repo.updateEvent(eventId, { judgeIds: [judge] });
  return { event: (await db.events.get(eventId))!, dances };
}

function renderModal(event: CompEvent) {
  const onClose = vi.fn();
  render(
    <MantineProvider env="test">
      <EventPdfModal event={event} opened onClose={onClose} />
    </MantineProvider>,
  );
  return onClose;
}

beforeEach(async () => {
  Object.values(actions).forEach((f) => f.mockClear());
  await db.delete();
  await db.open();
});
afterEach(cleanup);

describe('EventPdfModal', () => {
  it('prints the skating order of the ticked parts and stays open', async () => {
    const { event, dances } = await seed();
    const onClose = renderModal(event);
    const open = await screen.findByText('Create skating order');
    await waitFor(() => expect(screen.getByLabelText(dances[1]!.name)).toBeTruthy());

    fireEvent.click(screen.getByLabelText(dances[1]!.name)); // untick the second dance
    fireEvent.click(open);

    await waitFor(() => expect(actions.printSkatingOrder).toHaveBeenCalledTimes(1));
    const [target, name, parts] = actions.printSkatingOrder.mock.calls[0] as unknown as [
      string,
      string,
      Set<string>,
    ];
    expect(target).toEqual({ eventId: event.id });
    expect(name).toBe('Novice');
    expect(parts.size).toBe(2); // the first dance and the free dance
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Create skating order')).toBeTruthy();
  });

  it('cannot print the skating order with no parts ticked', async () => {
    const { event } = await seed();
    renderModal(event);
    const open = await screen.findByText('Create skating order');
    await waitFor(() => expect(screen.getAllByText('None').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText('None'));
    expect((open.closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('prints judge sheets in the chosen layout, for all parts unless some are unticked', async () => {
    const { event, dances } = await seed();
    renderModal(event);
    fireEvent.click(await screen.findByText('Judge sheets'));
    fireEvent.click(await screen.findByText('Create judge sheets'));
    await waitFor(() => expect(actions.printJudgeSheets).toHaveBeenCalledTimes(1));
    expect(actions.printJudgeSheets.mock.calls[0]).toEqual([
      { eventId: event.id },
      'Novice',
      { layout: 'combined' },
    ]);

    fireEvent.click(screen.getByLabelText(/A sheet per dance/));
    fireEvent.click(screen.getByLabelText(dances[0]!.name));
    fireEvent.click(screen.getByText('Create judge sheets'));
    await waitFor(() => expect(actions.printJudgeSheets).toHaveBeenCalledTimes(2));
    const options = (
      actions.printJudgeSheets.mock.calls[1] as unknown as [
        unknown,
        unknown,
        { layout: string; segmentIds: Set<string> },
      ]
    )[2];
    expect(options.layout).toBe('perPart');
    expect(options.segmentIds.size).toBe(2);
    expect(screen.getByText('Create judge sheets')).toBeTruthy(); // still open
  });

  it('keeps results disabled until every mark is in', async () => {
    const { event } = await seed();
    renderModal(event);
    fireEvent.click(await screen.findByText('Results'));
    expect(await screen.findByText(/marks still to enter/)).toBeTruthy();
    expect((screen.getByText('Create results').closest('button') as HTMLButtonElement).disabled).toBe(true);
    expect(actions.printResults).not.toHaveBeenCalled();
  });
});
