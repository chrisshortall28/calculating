import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { deleteCompetition } from '../../db/repo';
import type { Competition } from '../../domain/types';

/** Asks before deleting a competition and everything in it; `onDeleted` runs once it has gone. */
export function confirmDeleteCompetition(
  competition: Pick<Competition, 'id' | 'name'>,
  onDeleted?: () => void,
) {
  modals.openConfirmModal({
    title: 'Delete competition',
    children: (
      <Text size="sm">
        Permanently delete “{competition.name}” and all its events, entries and marks from this device? Export
        a file first if you may need it again.
      </Text>
    ),
    labels: { confirm: 'Delete', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      await deleteCompetition(competition.id);
      onDeleted?.();
    },
  });
}
