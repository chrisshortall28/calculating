import { Alert } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import type { ReactNode } from 'react';

/** Explains what a competition-wide list is for and how it relates to the events. */
export function RosterNote({ children }: { children: ReactNode }) {
  return (
    <Alert icon={<IconInfoCircle />} color="blue" variant="light">
      {children}
    </Alert>
  );
}
