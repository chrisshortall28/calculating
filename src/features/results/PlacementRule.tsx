import { Anchor, Badge, Group, List, Stack, Text, Tooltip } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import {
  explainStep,
  formatVictories,
  ordinalLabel,
  RULES,
  ruleLabel,
  type PlacementRule,
  type PlacementStep,
} from '../../scoring';

/** The CIPA rule number that decided a place, with its meaning on hover. Blank for rule 5 (no tie). */
export function RuleBadge({ rule }: { rule: PlacementRule }) {
  if (rule === '5') return null;
  return (
    <Tooltip label={`Rule ${ruleLabel(rule)} — ${RULES[rule].description}`} multiline w={280} withArrow>
      <Badge size="sm" variant="light" color={rule === '8' ? 'orange' : 'blue'} style={{ cursor: 'help' }}>
        {ruleLabel(rule)}
      </Badge>
    </Tooltip>
  );
}

/** The CIPA scoring manual in public/, opened at its scoring rules (pages 4–13). */
const CIPA_MANUAL_URL = `${import.meta.env.BASE_URL}${encodeURIComponent('2009 - The CIPA System of Scoring.pdf')}#page=4`;

/** "How ties were resolved": each place decided by a tie-break, with the values compared. */
export function TieExplanations({ steps, label }: { steps: PlacementStep[]; label: (id: string) => string }) {
  const ties = steps.filter((s) => s.rule !== '5');
  if (ties.length === 0) return null;
  return (
    <Stack gap={4} mt="md">
      <Group justify="space-between" gap="xs">
        <Text size="sm" fw={600}>
          How ties were resolved
        </Text>
        <Anchor href={CIPA_MANUAL_URL} target="_blank" rel="noopener" size="xs">
          <Group gap={4} wrap="nowrap">
            <IconFileText size={14} />
            CIPA scoring rules (PDF)
          </Group>
        </Anchor>
      </Group>
      <List size="sm" spacing={6} listStyleType="none">
        {ties.map((s, i) => (
          <List.Item key={i}>
            <Text span fw={600}>
              {ordinalLabel(s.place)}
              {s.entryIds.length > 1 && '='}
            </Text>{' '}
            {s.entryIds.map(label).join(', ')} <RuleBadge rule={s.rule} />
            {s.trail.length > 0 && (
              <Text size="xs" c="dimmed">
                Tied on {formatVictories(s.tiedOn ?? 0)} majority victories:{' '}
                {s.contenders.map(label).join(', ')}.
              </Text>
            )}
            {explainStep(s, label).map((line, li) => (
              <Text key={li} size="xs" c="dimmed">
                {line}
              </Text>
            ))}
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}
