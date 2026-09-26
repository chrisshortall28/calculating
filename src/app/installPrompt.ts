import { useSyncExternalStore } from 'react';

/** Chrome/Edge's install event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Registered at module load: the event fires once, soon after the page loads, so we must be
// listening before any component that wants it has mounted.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** True when Podium is running as an installed app rather than in a browser tab. */
export const isInstalled = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true);

/**
 * The browser's install prompt, when it offers one (Chrome and Edge; not Safari or Firefox).
 * Returns null when unavailable or already installed.
 */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const available = useSyncExternalStore(subscribe, () => deferred !== null);
  if (!available) return null;
  return async () => {
    const e = deferred;
    if (!e) return;
    await e.prompt();
    await e.userChoice;
    deferred = null;
    notify();
  };
}
