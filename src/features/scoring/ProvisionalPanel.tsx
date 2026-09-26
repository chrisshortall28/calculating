import { Badge, Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import type { GridRow } from '../../marks/MarkGrid';
import type { EventResult } from '../../scoring';

export function ProvisionalPanel({
  result,
  rows,
  activeSegmentId,
}: {
  result: EventResult;
  rows: GridRow[];
  activeSegmentId: string;
}) {
  const label = new Map(rows.map((r) => [r.id, r.label]));
  const seg = result.segments.find((s) => s.segmentId === activeSegmentId);
  const multi = result.segments.length > 1;

  const segRows = seg?.complete ? [...seg.places.entries()].sort((a, b) => a[1] - b[1]) : [];

  return (
    <Stack>
      {multi && (
        <Card withBorder>
          <Group justify="space-between" mb="xs">
            <Title order={5}>{seg?.name}</Title>
            {!seg?.complete && (
              <Badge variant="light" color="gray">
                Waiting for marks
              </Badge>
            )}
          </Group>
          {seg?.complete ? (
            <Table>
              <Table.Tbody>
                {segRows.map(([entryId, place]) => (
                  <Table.Tr key={entryId}>
                    <Table.Td w={40} fw={700}>
                      {place}
                    </Table.Td>
                    <Table.Td>{label.get(entryId)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text size="sm" c="dimmed">
              {seg?.missingMarks} marks still to enter.
            </Text>
          )}
        </Card>
      )}
      <Card withBorder>
        <Group justify="space-between" mb="xs">
          <Title order={5}>Event result</Title>
          <Badge variant="light" color={result.complete ? 'green' : 'gray'}>
            {result.complete ? 'Complete' : 'Provisional'}
          </Badge>
        </Group>
        {result.complete ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>Pl</Table.Th>
                <Table.Th>Entry</Table.Th>
                {multi && <Table.Th ta="right">Places</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.overall.map((o) => (
                <Table.Tr key={o.entryId}>
                  <Table.Td fw={700}>
                    {o.place}
                    {o.tied && '='}
                  </Table.Td>
                  <Table.Td>{label.get(o.entryId)}</Table.Td>
                  {multi && (
                    <Table.Td ta="right" c="dimmed">
                      {o.segmentPlaces.join(' + ')} = {o.score}
                    </Table.Td>
                  )}
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
    </Stack>
  );
}
