import { Accordion, Alert, Badge, Button, Card, Group, List, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFileText, IconPrinter } from '@tabler/icons-react';
import { useState } from 'react';
import { useJudges, useSkaters } from '../../app/data';
import { byId, entryClub, entryName } from '../../domain/entryName';
import { markKeyLabel } from '../../domain/segments';
import type { CompEvent, Competition } from '../../domain/types';
import { formatTenths } from '../../marks/parseMark';
import { printJudgeSheets, printResults } from '../../pdf/actions';
import { ordinalLabel, type ExplainStep } from '../../scoring';
import { markKey, useEventResult } from '../scoring/useEventResult';

export function ResultsTab({ event }: { event: CompEvent; competition: Competition }) {
  const { loading, segments, entries, markMap, result } = useEventResult(event);
  const skaters = byId(useSkaters(event.competitionId));
  const judgeMap = byId(useJudges(event.competitionId));
  const [busy, setBusy] = useState<string | null>(null);
  if (loading) return null;

  const entryMap = byId(entries);
  const label = (id: string) => (entryMap.get(id) ? entryName(entryMap.get(id)!, skaters) : '?');
  const multi = segments.length > 1;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      notifications.show({ color: 'red', title: 'PDF failed', message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Stack>
      <Group>
        <Button
          variant="default"
          leftSection={<IconPrinter size={16} />}
          loading={busy === 'sheets'}
          onClick={() => run('sheets', () => printJudgeSheets({ eventId: event.id }, event.name))}
        >
          Judge sheets PDF
        </Button>
        <Button
          leftSection={<IconFileText size={16} />}
          disabled={!result.complete}
          loading={busy === 'results'}
          onClick={() => run('results', () => printResults({ eventId: event.id }, event.name, false))}
        >
          Results PDF
        </Button>
        <Button
          variant="light"
          leftSection={<IconFileText size={16} />}
          disabled={!result.complete}
          loading={busy === 'detail'}
          onClick={() => run('detail', () => printResults({ eventId: event.id }, event.name, true))}
        >
          Results with marks PDF
        </Button>
      </Group>

      {!result.complete && (
        <Alert color="yellow" variant="light">
          {event.judgeIds.length === 0
            ? 'No judges assigned yet.'
            : `${result.missingMarks} of ${result.totalMarks} marks still to enter.`}{' '}
          Final results appear when every mark is in.
        </Alert>
      )}

      {result.complete && (
        <Card withBorder>
          <Title order={4} mb="sm">
            Final placings
          </Title>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={60}>Place</Table.Th>
                <Table.Th>Entry</Table.Th>
                <Table.Th>Club</Table.Th>
                {multi &&
                  segments.map((s) => (
                    <Table.Th key={s.id} ta="center">
                      {s.name}
                    </Table.Th>
                  ))}
                {multi && <Table.Th ta="center">Sum</Table.Th>}
                <Table.Th ta="right">Total points</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.overall.map((o) => {
                const entry = entryMap.get(o.entryId)!;
                return (
                  <Table.Tr key={o.entryId}>
                    <Table.Td fw={700} fz="lg">
                      {o.place}
                      {o.tied && '='}
                    </Table.Td>
                    <Table.Td fw={500}>{entryName(entry, skaters)}</Table.Td>
                    <Table.Td c="dimmed">{entryClub(entry, skaters)}</Table.Td>
                    {multi &&
                      o.segmentPlaces.map((p, i) => (
                        <Table.Td key={i} ta="center">
                          {p}
                        </Table.Td>
                      ))}
                    {multi && (
                      <Table.Td ta="center" fw={600}>
                        {o.score}
                      </Table.Td>
                    )}
                    <Table.Td ta="right" c="dimmed">
                      {formatTenths(o.totalTenths)}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
          {multi && (
            <Steps title="How the event result was decided" steps={result.overallSteps} label={label} />
          )}
        </Card>
      )}

      <Accordion variant="separated" multiple defaultValue={segments.map((s) => s.id)}>
        {segments.map((seg, si) => {
          const sr = result.segments[si]!;
          const multiKey = seg.markKeys.length > 1;
          return (
            <Accordion.Item key={seg.id} value={seg.id}>
              <Accordion.Control>
                <Group>
                  <Text fw={600}>{seg.name}</Text>
                  <Badge variant="light" color={sr.complete ? 'green' : 'yellow'}>
                    {sr.complete ? 'Complete' : `${sr.missingMarks} missing`}
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Table withColumnBorders fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Entry</Table.Th>
                      {event.judgeIds.map((j, ji) => (
                        <Table.Th key={j} ta="center" colSpan={seg.markKeys.length + 1}>
                          J{ji + 1} {judgeMap.get(j)?.name}
                        </Table.Th>
                      ))}
                      <Table.Th ta="center">Place</Table.Th>
                    </Table.Tr>
                    {multiKey && (
                      <Table.Tr>
                        <Table.Th />
                        {event.judgeIds.map((j) => [
                          ...seg.markKeys.map((k) => (
                            <Table.Th key={j + k} ta="center">
                              {markKeyLabel(k)}
                            </Table.Th>
                          )),
                          <Table.Th key={j + 'pl'} ta="center" c="dimmed">
                            pl
                          </Table.Th>,
                        ])}
                        <Table.Th />
                      </Table.Tr>
                    )}
                  </Table.Thead>
                  <Table.Tbody>
                    {entries.map((e) => (
                      <Table.Tr key={e.id}>
                        <Table.Td>{entryName(e, skaters)}</Table.Td>
                        {event.judgeIds.map((j) => [
                          ...seg.markKeys.map((k) => (
                            <Table.Td key={j + k} ta="center">
                              {formatTenths(markMap.get(markKey(k, j, e.id))) || '—'}
                            </Table.Td>
                          )),
                          <Table.Td key={j + 'pl'} ta="center" c="dimmed">
                            {sr.complete ? sr.ordinals.get(j)?.get(e.id) : ''}
                          </Table.Td>,
                        ])}
                        <Table.Td ta="center" fw={700}>
                          {sr.places.get(e.id) ?? ''}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                {sr.complete && (
                  <Steps
                    title={`Majority needed: ${result.majority} of ${event.judgeIds.length} judges`}
                    steps={sr.steps}
                    label={label}
                  />
                )}
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Stack>
  );
}

function Steps({
  title,
  steps,
  label,
}: {
  title: string;
  steps: ExplainStep[];
  label: (id: string) => string;
}) {
  return (
    <Stack gap={4} mt="md">
      <Text size="sm" fw={600}>
        {title}
      </Text>
      <List size="sm" spacing={2}>
        {steps.map((s, i) => (
          <List.Item key={i}>
            <Text span fw={600}>
              {ordinalLabel(s.place)}
            </Text>{' '}
            {s.entryIds.map(label).join(', ')} —{' '}
            <Badge size="xs" variant="light" color={s.rule === 'Tie' ? 'orange' : 'blue'}>
              {s.rule}
            </Badge>{' '}
            <Text span c="dimmed">
              {s.detail}
            </Text>
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}
