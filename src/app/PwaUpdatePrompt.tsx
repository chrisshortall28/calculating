import { Button, Group, Notification } from '@mantine/core';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <Notification
      title="Update available"
      onClose={() => setNeedRefresh(false)}
      style={{
        position: 'fixed',
        bottom: 'calc(var(--app-shell-footer-offset, 0px) + 16px)',
        left: 16,
        zIndex: 1000,
        maxWidth: 360,
      }}
    >
      <Group justify="space-between" mt={4}>
        A new version of Podium is ready.
        <Button size="xs" onClick={() => updateServiceWorker(true)}>
          Reload
        </Button>
      </Group>
    </Notification>
  );
}
