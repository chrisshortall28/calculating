// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PastedRow } from '../../domain/pasteList';
import { PasteListModal } from './PasteListModal';

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
if (!document.fonts)
  Object.defineProperty(document, 'fonts', {
    value: { addEventListener: () => {}, removeEventListener: () => {} },
  });

afterEach(cleanup);

function renderModal() {
  const onAdd = vi.fn(async (_rows: PastedRow[]) => {});
  render(
    <MantineProvider env="test">
      <PasteListModal
        opened
        onClose={() => {}}
        title="Paste skaters"
        type="solo"
        noun="skaters"
        onAdd={onAdd}
      />
    </MantineProvider>,
  );
  return onAdd;
}

const paste = (value: string) => fireEvent.change(screen.getAllByRole('textbox')[0]!, { target: { value } });

describe('PasteListModal with a spreadsheet', () => {
  it('joins first name and surname, ignores Age and adds the club', async () => {
    const onAdd = renderModal();
    paste('First Name\tSurname\tAge\tClub\nAmy\tAnkers\t25\tMedway\nBaloo\tAloobs\t64\tMidway');
    expect(await screen.findByText('Amy Ankers')).toBeTruthy();
    expect(screen.getByText('Midway')).toBeTruthy();
    expect(screen.getByText('Columns found — check what each holds')).toBeTruthy();
    fireEvent.click(screen.getByText(/Add 2/));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0]![0].map((r) => [r.names, r.club])).toEqual([
      [['Amy Ankers'], 'Medway'],
      [['Baloo Aloobs'], 'Midway'],
    ]);
  });

  it('lets the user say what each column holds when there is no header', async () => {
    const onAdd = renderModal();
    paste('Amy\tAnkers\t25\tMedway\nBaloo\tAloobs\t64\tMidway');
    // The usual guess takes the second column as the club.
    expect((await screen.findAllByText('Ankers')).length).toBeGreaterThan(1); // as a sample and as the club
    expect(screen.getByText('Columns — say what each holds')).toBeTruthy();

    const choose = async (column: number, label: string) => {
      fireEvent.click(screen.getByLabelText(new RegExp(`^Column ${column}:`)));
      fireEvent.click(within(await screen.findByRole('listbox')).getByText(label));
    };
    await choose(1, 'First name');
    await choose(2, 'Surname');
    await choose(4, 'Club');

    expect(await screen.findByText('Amy Ankers')).toBeTruthy();
    fireEvent.click(screen.getByText(/Add 2/));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(onAdd.mock.calls[0]![0].map((r) => [r.names, r.club])).toEqual([
      [['Amy Ankers'], 'Medway'],
      [['Baloo Aloobs'], 'Midway'],
    ]);
  });

  it('shows no column choices for a plain list', async () => {
    renderModal();
    paste('Jane Smith, City\nAmy Jones');
    expect(await screen.findByText('Jane Smith')).toBeTruthy();
    expect(screen.queryByText(/Columns/)).toBeNull();
  });
});
