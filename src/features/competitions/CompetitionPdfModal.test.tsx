// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCompetition } from '../../app/data';
import { db } from '../../db/db';
import * as repo from '../../db/repo';
import { danceEventDefaults } from '../../domain/segments';
import type { Competition } from '../../domain/types';

const actions = vi.hoisted(() => ({
  printProgramme: vi.fn(async () => {}),
  printSkatingOrder: vi.fn(async () => {}),
  printJudgeSheets: vi.fn(async () => {}),
  printResults: vi.fn(async () => ({ complete: 1, total: 2 })),
}));
vi.mock('../../pdf/actions', () => actions);

import { CompetitionPdfModal } from './CompetitionPdfModal';

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
// jsdom has no font loading events, which autosizing textareas listen to.
if (!document.fonts)
  Object.defineProperty(document, 'fonts', {
    value: { addEventListener: () => {}, removeEventListener: () => {} },
  });

async function seed() {
  const compId = await repo.createCompetition({ name: 'Spring Open', date: '', venue: '' });
  const dances = await db.dances.where({ competitionId: compId }).toArray();
  const ids: string[] = [];
  for (const name of ['Novice', 'Junior']) {
    ids.push(
      await repo.createEvent(compId, {
        name,
        entryType: 'solo',
        compulsoryDanceIds: [dances[0]!.id],
        hasFreeDance: true,
        ...danceEventDefaults(),
      }),
    );
  }
  return { competition: (await db.competitions.get(compId))!, ids };
}

/** Like the competition page, follows the stored competition so saved changes show up. */
function Live({ id, onClose }: { id: string; onClose: () => void }) {
  const competition = useCompetition(id);
  return competition ? <CompetitionPdfModal competition={competition} opened onClose={onClose} /> : null;
}

function renderModal(competition: Competition) {
  const onClose = vi.fn();
  render(
    <MantineProvider env="test">
      <Live id={competition.id} onClose={onClose} />
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

describe('CompetitionPdfModal', () => {
  it('creates the programme and stays open', async () => {
    const { competition } = await seed();
    const onClose = renderModal(competition);
    fireEvent.click(await screen.findByText('Create programme'));
    await waitFor(() => expect(actions.printProgramme).toHaveBeenCalledWith(competition.id, 'Spring Open'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Create programme')).toBeTruthy();
  });

  it('saves the welcome message, and only lets the programme be created once it is saved', async () => {
    const { competition } = await seed();
    renderModal(competition);
    const box = (await screen.findByLabelText('Welcome message')) as HTMLTextAreaElement;
    const save = screen.getByText('Save message').closest('button') as HTMLButtonElement;
    const create = screen.getByText('Create programme').closest('button') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(create.disabled).toBe(false);

    fireEvent.change(box, { target: { value: '  Welcome, skaters!  ' } });
    expect(save.disabled).toBe(false);
    expect(create.disabled).toBe(true);

    fireEvent.click(save);
    await waitFor(async () =>
      expect((await db.competitions.get(competition.id))?.welcome).toBe('Welcome, skaters!'),
    );
    await waitFor(() => expect(create.disabled).toBe(false));
    expect(save.disabled).toBe(true);

    // Emptying it goes back to the standard welcome.
    fireEvent.change(box, { target: { value: '' } });
    fireEvent.click(save);
    await waitFor(async () => expect((await db.competitions.get(competition.id))?.welcome).toBeUndefined());
  });

  it('prints every event unless some are unticked, then only the ticked ones', async () => {
    const { competition, ids } = await seed();
    renderModal(competition);
    fireEvent.click(await screen.findByText('Skating order'));
    fireEvent.click(await screen.findByText('Create skating order'));
    await waitFor(() => expect(actions.printSkatingOrder).toHaveBeenCalledTimes(1));
    expect(actions.printSkatingOrder.mock.calls[0]).toEqual([
      { competitionId: competition.id },
      'Spring Open',
    ]);

    await waitFor(() => expect(screen.getByLabelText('Junior')).toBeTruthy());
    expect(screen.getByText('Which events (2/2)')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Junior'));
    expect(screen.getByText('Which events (1/2)')).toBeTruthy();
    fireEvent.click(screen.getByText('Create skating order'));
    await waitFor(() => expect(actions.printSkatingOrder).toHaveBeenCalledTimes(2));
    const [target] = actions.printSkatingOrder.mock.calls[1] as unknown as [
      { competitionId: string; eventIds: Set<string> },
    ];
    expect(target.competitionId).toBe(competition.id);
    expect([...target.eventIds]).toEqual([ids[0]]);
  });

  it('cannot create anything for no events, and passes the layout to the judge sheets', async () => {
    const { competition } = await seed();
    renderModal(competition);
    fireEvent.click(await screen.findByText('Judge sheets'));
    fireEvent.click(await screen.findByLabelText(/A sheet per dance or figure/));
    fireEvent.click(screen.getByText('Create judge sheets'));
    await waitFor(() => expect(actions.printJudgeSheets).toHaveBeenCalledTimes(1));
    expect(actions.printJudgeSheets.mock.calls[0]).toEqual([
      { competitionId: competition.id },
      'Spring Open',
      { layout: 'perPart' },
    ]);
    fireEvent.click(screen.getByText('None'));
    expect(screen.getByText('Which events (0/2)')).toBeTruthy();
    expect((screen.getByText('Create judge sheets').closest('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('creates results in the chosen style', async () => {
    const { competition } = await seed();
    renderModal(competition);
    fireEvent.click(await screen.findByText('Results'));
    fireEvent.click(await screen.findByLabelText(/Results with marks/));
    fireEvent.click(screen.getByText('Create results'));
    await waitFor(() => expect(actions.printResults).toHaveBeenCalledTimes(1));
    const [target, name, style] = actions.printResults.mock.calls[0] as unknown as [
      { competitionId: string },
      string,
      string,
    ];
    expect(target.competitionId).toBe(competition.id);
    expect([name, style]).toEqual(['Spring Open', 'withMarks']);
  });
});
