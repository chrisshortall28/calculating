import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';

/** Runs `action` straight away, or after confirmation if it would delete `count` marks. */
export function confirmMarkLoss(count: number, what: string, action: () => unknown) {
  if (count === 0) return void action();
  modals.openConfirmModal({
    title: 'Marks will be deleted',
    children: (
      <Text size="sm">
        {what} will delete {count} entered mark{count === 1 ? '' : 's'}. Continue?
      </Text>
    ),
    labels: { confirm: 'Delete marks and continue', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm: action,
  });
}
