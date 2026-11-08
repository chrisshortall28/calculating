import { Alert, Box } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { CompEvent } from '../../domain/types';

/** An event marked final can no longer have its skaters or judges changed (unlock it on the Scoring tab). */
export const isFinal = (event: Pick<CompEvent, 'status'>) => event.status === 'final';

/**
 * Wraps a tab's editing controls: when `locked`, says why and disables every button and box inside (a
 * disabled fieldset covers them all, drag handles included).
 */
export function EditLock({
  locked,
  what,
  maw,
  children,
}: {
  locked: boolean;
  /** What can't be changed, e.g. "skaters". */
  what: string;
  maw?: number;
  children: ReactNode;
}) {
  return (
    <Box maw={maw}>
      {locked && (
        <Alert color="yellow" variant="light" icon={<IconLock size={18} />} mb="md">
          This event is marked final, so its {what} can’t be changed. Unlock it on the Scoring tab to make
          changes.
        </Alert>
      )}
      <Box component="fieldset" disabled={locked} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        {children}
      </Box>
    </Box>
  );
}
