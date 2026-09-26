import {
  ActionIcon,
  AppShell,
  Button,
  Group,
  Text,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconHelpCircle, IconMoon, IconSun, IconTrophyFilled } from '@tabler/icons-react';
import { Link, Outlet } from 'react-router';
import classes from './Layout.module.css';
import { PwaUpdatePrompt } from './PwaUpdatePrompt';
import { StatusBar } from './StatusBar';

export function Layout() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');
  return (
    <AppShell header={{ height: 60 }} footer={{ height: 32 }} padding="lg">
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
          <Group gap="xs" wrap="nowrap">
            <Button
              component={Link}
              to="/guide"
              variant="subtle"
              color="gray.0"
              leftSection={<IconHelpCircle size={20} />}
              visibleFrom="xs"
            >
              Guide
            </Button>
            <Tooltip label="Guide">
              <ActionIcon
                component={Link}
                to="/guide"
                variant="subtle"
                color="gray.0"
                size="lg"
                hiddenFrom="xs"
                aria-label="Guide"
              >
                <IconHelpCircle size={20} />
              </ActionIcon>
            </Tooltip>
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
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
        <PwaUpdatePrompt />
      </AppShell.Main>
      <AppShell.Footer className={classes.footer}>
        <StatusBar />
      </AppShell.Footer>
    </AppShell>
  );
}
