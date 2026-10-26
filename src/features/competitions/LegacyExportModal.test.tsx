// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import { importCompetition } from '../../io/competitionFile';
import { downloadBytes } from '../../io/zip';
import { convertLegacyCompetition, groupLegacyEvents } from '../../legacy/convert';
import { buildEventFile, type FixtureEvent } from '../../legacy/fixtures';
import { readLegacyEvent } from '../../legacy/readEvent';
import { LegacyExportModal } from './LegacyExportModal';

vi.mock('../../io/zip', async (original) => ({
  ...(await original<typeof import('../../io/zip')>()),
  downloadBytes: vi.fn(),
}));

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

/** Imports legacy events as a Podium competition and returns its id. */
async function competitionWith(...events: FixtureEvent[]) {
  const read = events.map((e, i) =>
    readLegacyEvent(`DATA00${i + 1}B.ROL`, buildEventFile({ date: '9th August 2026', ...e })),
  );
  const { file } = convertLegacyCompetition(groupLegacyEvents(read)[0]!);
  return importCompetition(file, 'replace');
}

function open(competitionId: string) {
  const onClose = vi.fn();
  render(
    <MantineProvider env="test">
      <Notifications />
      <LegacyExportModal competitionId={competitionId} opened onClose={onClose} />
    </MantineProvider>,
  );
  return onClose;
}

beforeEach(async () => {
  vi.mocked(downloadBytes).mockClear();
  await Promise.all(db.tables.map((t) => t.clear()));
});
afterEach(cleanup);

describe('Export for Calculating For Windows', () => {
  it('lists the files, then downloads them in a zip', async () => {
    const id = await competitionWith(
      {
        name: '2A Solo',
        compulsory: [{ code: 20 }],
        entries: [
          { name: 'Ann', club: 'X', blocks: { 0: [10, 11, 12] } },
          { name: 'Bo', club: 'Y', blocks: { 0: [13, 14, 15] } },
        ],
      },
      {
        name: 'Figures',
        typeCode: 0,
        compulsory: [{ code: 1 }],
        entries: [{ name: 'Cy', blocks: { 0: [10, 10, 10] } }],
      },
    );
    const onClose = open(id);

    await screen.findByText('DATA001B.ROL');
    expect(screen.getByText('2A Solo')).toBeTruthy();
    expect(screen.getByText('Not exported')).toBeTruthy();
    expect(screen.getByText(/Figures: figures events can not be exported yet/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Download \.zip/ }));
    await waitFor(() => expect(downloadBytes).toHaveBeenCalledTimes(1));
    const [data, name, type] = vi.mocked(downloadBytes).mock.calls[0]!;
    expect(name).toBe('Test-Competition-Calculating-For-Windows.zip');
    expect(type).toBe('application/zip');
    expect([...data.subarray(0, 2)]).toEqual([0x50, 0x4b]); // "PK"
    expect(new TextDecoder().decode(data)).toContain('DATA001B.ROL');
    expect(onClose).toHaveBeenCalled();
  });

  it('says so, and offers no download, when no event can be exported', async () => {
    const id = await competitionWith({
      name: 'Figures only',
      typeCode: 0,
      compulsory: [{ code: 1 }],
      entries: [{ name: 'Cy', blocks: { 0: [10, 10, 10] } }],
    });
    open(id);
    await screen.findByText('Nothing to export');
    expect((screen.getByRole('button', { name: /Download \.zip/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
