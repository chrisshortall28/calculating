import { Badge, Group, Text } from '@mantine/core';
import type { ReactNode } from 'react';

/** Bold condensed section title with an optional count, hint and action. */
export function SectionHeader({
  title,
  count,
  hint,
  action,
}: {
  title: string;
  count?: number;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-end">
      <Group gap="sm" align="baseline">
        <Text
          component="h2"
          className="display"
          fz={30}
          m={0}
          c="light-dark(var(--mantine-color-navy-9), var(--mantine-color-white))"
        >
          {title}
        </Text>
        {count !== undefined && (
          <Badge color="medal.5" c="navy.9" size="lg" radius="sm">
            {count}
          </Badge>
        )}
        {hint && (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        )}
      </Group>
      {action}
    </Group>
  );
}
