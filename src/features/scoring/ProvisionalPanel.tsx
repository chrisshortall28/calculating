import { Badge, Card, Group, Table, Text, Title } from '@mantine/core';
import type { GridRow } from '../../marks/MarkGrid';
import { formatVictories, type EventResult } from '../../scoring';
import { RuleBadge } from '../results/PlacementRule';

/**
 * The event result once every mark is in; before that, the standing from the dances completed so
 * far (CIPA places the whole event on each judge's sum, so there are no per-dance places).
 */
export function ProvisionalPanel({
  result,
  standing,
  standingAfter,
  rows,
}: {
  result: EventResult;
  standing?: EventResult;
  standingAfter: string[];
  rows: GridRow[];
}) {
  const label = new Map(rows.map((r) => [r.id, r.label]));
  const shown = result.complete ? result : standing;

  return (
    <Card withBorder>
      <Group justify="space-between" mb="xs">
        <Title order={5}>{result.complete ? 'Event result' : 'Standing so far'}</Title>
        <Badge variant="light" color={result.complete ? 'green' : 'gray'}>
          {result.complete ? 'Complete' : 'Provisional'}
        </Badge>
      </Group>
      {!result.complete && standing && (
        <Text size="xs" c="dimmed" mb="xs">
          After {standingAfter.join(', ')}.
        </Text>
      )}
      {shown ? (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40}>Pl</Table.Th>
              <Table.Th>Entry</Table.Th>
              <Table.Th ta="center" title="Majority victories">
                MV
              </Table.Th>
              <Table.Th ta="center">Rule</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {shown.overall.map((o) => (
              <Table.Tr key={o.entryId}>
                <Table.Td fw={700}>
                  {o.place}
                  {o.tied && '='}
                </Table.Td>
                <Table.Td>{label.get(o.entryId)}</Table.Td>
                <Table.Td ta="center" c="dimmed">
                  {formatVictories(o.majorityVictories)}
                </Table.Td>
                <Table.Td ta="center">
                  <RuleBadge rule={o.rule} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          The result appears once every mark has been entered ({result.missingMarks} to go).
        </Text>
      )}
    </Card>
  );
}
