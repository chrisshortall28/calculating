import { ActionIcon, Anchor, AppShell, Group, Text, Tooltip, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun, IconTrophy } from '@tabler/icons-react';
import { Link, Outlet } from 'react-router';
import { PwaUpdatePrompt } from './PwaUpdatePrompt';

export function Layout() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  return (
    <AppShell header={{ height: 52 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Anchor component={Link} to="/" underline="never" c="inherit">
            <Group gap={8}>
              <IconTrophy size={22} color="var(--mantine-color-blue-6)" />
              <Text fw={700} size="lg">
                Podium
              </Text>
            </Group>
          </Anchor>
          <Tooltip label="Toggle colour scheme">
            <ActionIcon variant="subtle" onClick={toggleColorScheme} aria-label="Toggle colour scheme">
              {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
        <PwaUpdatePrompt />
      </AppShell.Main>
    </AppShell>
  );
}
