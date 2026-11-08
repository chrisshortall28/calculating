// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersistentStoragePrompt } from './PersistentStoragePrompt';

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

const persist = vi.fn(async () => true);
const setup = (userAgent: string, persisted = false) => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: { persist, persisted: async () => persisted },
  });
  return render(
    <MantineProvider env="test">
      <PersistentStoragePrompt />
    </MantineProvider>,
  );
};

beforeEach(() => {
  persist.mockClear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PersistentStoragePrompt', () => {
  it('in Firefox explains first, and asks the browser only when the user continues', async () => {
    setup('Mozilla/5.0 Firefox/130.0');
    expect(await screen.findByText('Keep your competitions safe')).toBeTruthy();
    expect(persist).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Continue'));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('asks only once', async () => {
    setup('Mozilla/5.0 Firefox/130.0');
    fireEvent.click(await screen.findByText('Not now'));
    cleanup();
    setup('Mozilla/5.0 Firefox/130.0');
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('Keep your competitions safe')).toBeNull();
    expect(persist).not.toHaveBeenCalled();
  });

  it('does nothing when the data is already persistent', async () => {
    setup('Mozilla/5.0 Firefox/130.0', true);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('Keep your competitions safe')).toBeNull();
    expect(persist).not.toHaveBeenCalled();
  });

  it('in other browsers asks silently', async () => {
    setup('Mozilla/5.0 Chrome/120.0 Safari/537.36');
    await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Keep your competitions safe')).toBeNull();
  });
});
