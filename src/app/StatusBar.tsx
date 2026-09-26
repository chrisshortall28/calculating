import { Group, List, Modal, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { useDisclosure, useNetwork } from '@mantine/hooks';
import { IconCloudCheck, IconCloudOff } from '@tabler/icons-react';
import { Link } from 'react-router';
import { CHANGELOG } from './changelog';
import { formatLongDate } from './format';
import classes from './Layout.module.css';

/** Bottom bar: online/offline status and the app version, which opens the "What's New?" popup. */
export function StatusBar() {
  const { online } = useNetwork();
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Group h="100%" px="lg" justify="space-between" wrap="nowrap" className={classes.statusBar}>
        <Tooltip
          label={
            online
              ? 'Connected to the internet. Podium checks for new versions when it starts. Click for the guide.'
              : 'No internet connection. Podium keeps working and your data is saved on this device. Click for the guide.'
          }
          multiline
          w={260}
        >
          <UnstyledButton
            component={Link}
            to="/guide#offline"
            data-online={online || undefined}
            className={classes.network}
          >
            <Group gap={6} wrap="nowrap">
              {online ? <IconCloudCheck size={16} /> : <IconCloudOff size={16} />}
              <Text size="xs" span>
                {online ? 'Online' : 'Working offline'}
              </Text>
            </Group>
          </UnstyledButton>
        </Tooltip>
        <UnstyledButton onClick={open} className={classes.version} aria-label="What’s new in this version">
          v{__APP_VERSION__}
        </UnstyledButton>
      </Group>

      <Modal opened={opened} onClose={close} title="What’s New?">
        <Stack gap="lg">
          {CHANGELOG.map((r) => (
            <div key={r.version}>
              <Group gap="sm" align="baseline">
                <Text className="display" fz={22}>
                  Version {r.version}
                </Text>
                {r.version === __APP_VERSION__ && (
                  <Text size="xs" c="dimmed">
                    (this version)
                  </Text>
                )}
                {r.date && (
                  <Text size="xs" c="dimmed">
                    {formatLongDate(r.date)}
                  </Text>
                )}
              </Group>
              <List size="sm" spacing={4} mt={6}>
                {r.changes.map((c) => (
                  <List.Item key={c}>{c}</List.Item>
                ))}
              </List>
            </div>
          ))}
        </Stack>
      </Modal>
    </>
  );
}
