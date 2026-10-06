import { Badge } from '@mantine/core';
import { statusColor } from '../../app/theme';
import type { EventStatus } from '../../domain/types';

const LABEL: Record<EventStatus, string> = {
  setup: 'Setup',
  ready: 'Ready',
  scoring: 'Scoring',
  final: 'Final',
};

export function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge size="sm" color={statusColor[status]} variant={status === 'final' ? 'filled' : 'dot'}>
      {LABEL[status]}
    </Badge>
  );
}
