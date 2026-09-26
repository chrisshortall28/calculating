import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { CompetitionsPage } from '../features/competitions/CompetitionsPage';
import { CompetitionLayout } from '../features/competitions/CompetitionLayout';
import { EventsTab } from '../features/events/EventsTab';
import { SkatersTab } from '../features/roster/SkatersTab';
import { JudgesTab } from '../features/roster/JudgesTab';
import { DancesTab } from '../features/roster/DancesTab';
import { CompetitionSettingsTab } from '../features/competitions/CompetitionSettingsTab';
import { EventPage } from '../features/events/EventPage';
import { Layout } from './Layout';
import { theme } from './theme';
import { usePersistentStorage } from './usePersistentStorage';

const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { index: true, element: <CompetitionsPage /> },
        {
          path: 'c/:compId',
          element: <CompetitionLayout />,
          children: [
            { index: true, element: <EventsTab /> },
            { path: 'skaters', element: <SkatersTab /> },
            { path: 'judges', element: <JudgesTab /> },
            { path: 'dances', element: <DancesTab /> },
            { path: 'settings', element: <CompetitionSettingsTab /> },
          ],
        },
        { path: 'c/:compId/e/:eventId/:tab?', element: <EventPage /> },
      ],
    },
  ],
  // Served from a sub-path on GitHub Pages (e.g. /calculating/).
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);

export function App() {
  usePersistentStorage();
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ModalsProvider>
        <Notifications position="bottom-right" />
        <RouterProvider router={router} />
      </ModalsProvider>
    </MantineProvider>
  );
}
