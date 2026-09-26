import {
  ActionIcon,
  AppShell,
  Group,
  Text,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconMoon, IconSun, IconTrophyFilled } from '@tabler/icons-react';
import { Link, Outlet } from 'react-router';
import classes from './Layout.module.css';
import { PwaUpdatePrompt } from './PwaUpdatePrompt';

export function Layout() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');
  return (
    <AppShell header={{ height: 60 }} padding="lg">
      <AppShell.Header className={classes.header}>
        <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
          <UnstyledButton component={Link} to="/" className={classes.brand} aria-label="Podium home">
            <span className={classes.logo}>
              <IconTrophyFilled size={20} />
            </span>
            <span>
              <Text className={classes.wordmark}>Podium</Text>
              <Text className={classes.tagline} visibleFrom="sm">
                Artistic Roller Skating Scoring
              </Text>
            </span>
          </UnstyledButton>
          <Tooltip label={scheme === 'dark' ? 'Light mode' : 'Dark mode'}>
            <ActionIcon
              variant="subtle"
              color="gray.0"
              size="lg"
              onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle colour scheme"
            >
              {scheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
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
