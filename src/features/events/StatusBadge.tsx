import { Badge } from '@mantine/core';
import type { EventStatus } from '../../domain/types';

const STATUS: Record<EventStatus, { label: string; color: string }> = {
  setup: { label: 'Setup', color: 'gray' },
  scoring: { label: 'Scoring', color: 'blue' },
  final: { label: 'Final', color: 'green' },
};

export function StatusBadge({ status }: { status: EventStatus }) {
  const s = STATUS[status];
  return (
    <Badge size="sm" color={s.color} variant="dot">
      {s.label}
    </Badge>
  );
}
