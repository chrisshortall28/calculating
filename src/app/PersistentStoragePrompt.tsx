import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';

const ASKED_KEY = 'podium.persistentStorageAsked';

const read = () => {
  try {
    return localStorage.getItem(ASKED_KEY) !== null;
  } catch {
    return false;
  }
};
const remember = () => {
  try {
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    /* private window or blocked storage: we may ask again next time */
  }
};

/** Firefox asks the user before granting persistent storage; other browsers decide on their own. */
const browserAsksUser = () => /\bFirefox\//.test(navigator.userAgent);

/**
 * Asks the browser not to evict our IndexedDB data under storage pressure. Where the browser shows its own
 * permission prompt (Firefox), explains it first, once the user has a competition to protect, and only calls
 * `persist()` from the button click so the browser's prompt follows something the user just did.
 */
export function PersistentStoragePrompt() {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storage = navigator.storage;
      if (!storage?.persist || !storage.persisted) return;
      if (await storage.persisted()) return;
      if (!browserAsksUser()) {
        void storage.persist();
        return;
      }
      if (!read() && !cancelled) setOpened(true);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = async () => {
    remember();
    setOpened(false);
    try {
      if (await navigator.storage.persist()) {
        notifications.show({ color: 'green', message: 'Your data is now protected on this device.' });
      }
    } catch {
      /* the browser refused: the app works the same, backups matter more */
    }
  };

  const later = () => {
    remember();
    setOpened(false);
  };

  return (
    <Modal opened={opened} onClose={later} title="Keep your competitions safe" centered>
      <Stack>
        <Text size="sm">
          Podium keeps everything on this device; nothing is sent anywhere. Browsers can clear stored data
          when the disk is nearly full, unless you allow it to be kept.
        </Text>
        <Text size="sm">
          When you press Continue, Firefox will ask whether to allow Podium to store data in persistent
          storage. Please choose <b>Allow</b>.
        </Text>
        <Text size="sm" c="dimmed">
          Either way, export a <code>.pod</code> backup from time to time.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={later}>
            Not now
          </Button>
          <Button onClick={choose}>Continue</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
