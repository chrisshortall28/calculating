// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import { buildEventFile, type FixtureEvent } from '../../legacy/fixtures';
import { LegacyImportModal } from './LegacyImportModal';

// jsdom lacks these, which Mantine's colour scheme, scroll areas and the file reading below use.
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
File.prototype.arrayBuffer ??= function (this: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(this);
  });
};

const Location = () => <div data-testid="location">{useLocation().pathname}</div>;

const eventFile = (name: string, e: FixtureEvent) => new File([buildEventFile(e).slice()], name);

function open() {
  const onClose = vi.fn();
  render(
    <MantineProvider env="test">
      <Notifications />
      <MemoryRouter>
        <LegacyImportModal opened onClose={onClose} />
        <Location />
      </MemoryRouter>
    </MantineProvider>,
  );
  const input = document.querySelector('[role=dialog] input[type=file]:not([webkitdirectory])')!;
  const choose = (...files: File[]) => fireEvent.change(input, { target: { files } });
  return { choose, onClose };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
afterEach(cleanup);

describe('Import legacy', () => {
  it('shows a summary of the chosen files and imports the competition', async () => {
    const { choose, onClose } = open();
    choose(
      eventFile('DATA001B.ROL', {
        name: '1A Rising Stars',
        compulsory: [{ code: 28 }],
        entries: [
          { name: 'Ann Smith', club: 'Moonrake', blocks: { 0: [20, 20, 20] } },
          { name: 'Bo Jones', club: 'LJSS', blocks: { 0: [15, 12, 22] } },
        ],
      }),
      eventFile('DATA002B.ROL', { name: '25 Quartet', typeCode: 3, entries: [{ name: 'Moonrakers' }] }),
      new File(['log'], 'roller.tlg'),
    );

    await screen.findByText('Test Competition');
    expect(screen.getByText('1A Rising Stars')).toBeTruthy();
    expect(screen.getByText('Not imported')).toBeTruthy();
    expect(screen.getByText(/Ignored 1 other file: roller\.tlg/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Import competition' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(/^\/c\//));
    expect(onClose).toHaveBeenCalled();

    const [competition] = await db.competitions.toArray();
    expect(competition).toMatchObject({ name: 'Test Competition', date: '2026-08-09' });
    expect(await db.events.count()).toBe(1);
    expect(await db.marks.count()).toBe(6);
    expect((await db.dances.toArray()).map((d) => d.name)).toEqual(['Canasta Tango']);
  });

  it('warns when the competition is already on the device', async () => {
    await db.competitions.add({
      id: 'old',
      name: 'test competition',
      date: '2026-08-09',
      venue: '',
      createdAt: 0,
      updatedAt: 0,
    });
    const { choose } = open();
    choose(eventFile('DATA001B.ROL', { name: 'E', entries: [{ name: 'Ann' }] }));
    await screen.findByText(/already on this device/);
  });

  it('lets the user name an unknown dance and set the date, and imports with them', async () => {
    const { choose } = open();
    choose(
      eventFile('DATA001B.ROL', {
        name: '1A Rising Stars',
        date: 'Date',
        compulsory: [{ code: 99 }],
        entries: [{ name: 'Ann Smith', blocks: { 0: [20, 20, 20] } }],
      }),
    );

    fireEvent.change(await screen.findByLabelText('Dance number 99'), { target: { value: 'Bachata' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-05' } });
    fireEvent.click(screen.getAllByLabelText('Entries in 1A Rising Stars')[0]!);
    fireEvent.click(await screen.findByRole('option', { name: 'Duo' }));
    expect(screen.queryByText(/is not known yet/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Import competition' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(/^\/c\//));
    expect((await db.dances.toArray()).map((d) => d.name)).toEqual(['Bachata']);
    expect((await db.competitions.toArray())[0]).toMatchObject({ date: '2026-09-05' });
  });

  it('says so when no file is a legacy event file', async () => {
    const { choose } = open();
    choose(new File(['hello'], 'notes.txt'), new File([new Uint8Array(3000)], 'DATA9B.ROL'));
    const alert = await screen.findByText('No competition found: these files could not be read');
    expect(
      within(alert.closest('[role=alert]') as HTMLElement).getByText(/DATA9B\.ROL is not a Calculating/),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Import competition' })).toBeNull();
  });

  it('lets the user pick when the files hold more than one competition', async () => {
    const { choose } = open();
    choose(
      eventFile('DATA001B.ROL', { name: 'A', competition: 'First' }),
      eventFile('DATA002B.ROL', { name: 'B', competition: 'Second' }),
    );
    await screen.findByText(/more than one competition/);
  });
});
