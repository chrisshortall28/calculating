import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFileText, IconPrinter } from '@tabler/icons-react';
import { useState } from 'react';
import { useJudges, useSkaters } from '../../app/data';
import { byId, entryClub, entryHeading, entryName } from '../../domain/entryName';
import { markKeyLabel } from '../../domain/segments';
import type { CompEvent, Competition } from '../../domain/types';
import { formatTenths } from '../../marks/parseMark';
import { printJudgeSheets, printResults } from '../../pdf/actions';
import { officialsLine } from '../../pdf/documents';
import { explainJudgeTie, formatVictories, type EventResult } from '../../scoring';
import { markKey, useEventResult } from '../scoring/useEventResult';
import { RuleBadge, TieExplanations } from './PlacementRule';

export function ResultsTab({ event }: { event: CompEvent; competition: Competition }) {
  const { loading, segments, entries, markMap, result } = useEventResult(event);
  const skaters = byId(useSkaters(event.competitionId));
  const judgeMap = byId(useJudges(event.competitionId));
  const [busy, setBusy] = useState<string | null>(null);
  if (loading) return null;

  const entryMap = byId(entries);
  const label = (id: string) => (entryMap.get(id) ? entryName(entryMap.get(id)!, skaters) : '?');
  const judgeLabel = (id: string) => `J${event.judgeIds.indexOf(id) + 1}`;

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
          loading={busy === 'standard'}
          onClick={() => run('standard', () => printResults({ eventId: event.id }, event.name, 'standard'))}
        >
          Results PDF
        </Button>
        <Button
          variant="light"
          leftSection={<IconFileText size={16} />}
          disabled={!result.complete}
          loading={busy === 'withMarks'}
          onClick={() => run('withMarks', () => printResults({ eventId: event.id }, event.name, 'withMarks'))}
        >
          Results with marks PDF
        </Button>
        <Tooltip label="Placings and tie-break rules only — no victories, points or judge rankings" withArrow>
          <Button
            variant="light"
            color="grape"
            leftSection={<IconFileText size={16} />}
            disabled={!result.complete}
            loading={busy === 'guest'}
            onClick={() => run('guest', () => printResults({ eventId: event.id }, event.name, 'guest'))}
          >
            Guest judges PDF
          </Button>
        </Tooltip>
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
          <Title order={4}>Final placings</Title>
          <Text size="sm" c="dimmed" mb="sm">
            {officialsLine({
              judges: event.judgeIds.map((j) => judgeMap.get(j)).filter((j) => !!j),
              referee: event.refereeId ? judgeMap.get(event.refereeId) : undefined,
            })}
          </Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={60}>Place</Table.Th>
                <Table.Th>{entryHeading[event.entryType]}</Table.Th>
                <Table.Th>Club</Table.Th>
                <Table.Th ta="center" title="The CIPA rule that decided a tied place">
                  Rule
                </Table.Th>
                <Table.Th ta="center">Majority victories</Table.Th>
                <Table.Th ta="right">Total sums</Table.Th>
                {event.judgeIds.map((j, ji) => (
                  <Table.Th key={j} ta="center" title={`${judgeMap.get(j)?.name ?? ''} — ranking by sum`}>
                    J{ji + 1}
                  </Table.Th>
                ))}
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
                    <Table.Td ta="center">
                      <RuleBadge rule={o.rule} />
                    </Table.Td>
                    <Table.Td ta="center" fw={600}>
                      {formatVictories(o.majorityVictories)}
                    </Table.Td>
                    <Table.Td ta="right">{formatTenths(o.totalTenths)}</Table.Td>
                    {o.judgeRanks.map((rank, i) => (
                      <Table.Td key={i} ta="center" c="dimmed">
                        {rank}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
          <TieExplanations steps={result.steps} label={label} />
          {result.judgeTies.length > 0 && (
            <Stack gap={2} mt="md">
              <Text size="sm" fw={600}>
                Equal sums from one judge (rule 3)
              </Text>
              {result.judgeTies.map((t, i) => (
                <Text key={i} size="xs" c="dimmed">
                  {explainJudgeTie(t, label, judgeLabel)}
                </Text>
              ))}
            </Stack>
          )}
        </Card>
      )}

      <Accordion variant="separated" multiple defaultValue={['victories', ...segments.map((s) => s.id)]}>
        {result.complete && (
          <Accordion.Item value="victories">
            <Accordion.Control>
              <Text fw={600}>Summary of scores and table of victories</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <VictoriesTable
                event={event}
                result={result}
                entryIds={entries.map((e) => e.id)}
                label={label}
              />
            </Accordion.Panel>
          </Accordion.Item>
        )}
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
                      <Table.Th>{entryHeading[event.entryType]}</Table.Th>
                      {event.judgeIds.map((j, ji) => (
                        <Table.Th key={j} ta="center" colSpan={seg.markKeys.length}>
                          J{ji + 1} {judgeMap.get(j)?.name}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                    {multiKey && (
                      <Table.Tr>
                        <Table.Th />
                        {event.judgeIds.map((j) =>
                          seg.markKeys.map((k) => (
                            <Table.Th key={j + k} ta="center">
                              {markKeyLabel(k)}
                            </Table.Th>
                          )),
                        )}
                      </Table.Tr>
                    )}
                  </Table.Thead>
                  <Table.Tbody>
                    {entries.map((e) => (
                      <Table.Tr key={e.id}>
                        <Table.Td>{entryName(e, skaters)}</Table.Td>
                        {event.judgeIds.map((j) =>
                          seg.markKeys.map((k) => (
                            <Table.Td key={j + k} ta="center">
                              {formatTenths(markMap.get(markKey(k, j, e.id))) || '—'}
                            </Table.Td>
                          )),
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Stack>
  );
}

/**
 * The CIPA master chart: each judge's sum per entry (summary of scores), then the judges'
 * victories of each entry over every other (table of victories).
 */
function VictoriesTable({
  event,
  result,
  entryIds,
  label,
}: {
  event: CompEvent;
  result: EventResult;
  entryIds: string[];
  label: (id: string) => string;
}) {
  const rowOf = new Map(result.overall.map((o) => [o.entryId, o]));
  const judgeCount = event.judgeIds.length;
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        A judge’s sum is the total of all their marks for an entry. Each “v” column shows how many judges gave
        the entry a higher sum than that opponent; <b>bold</b> is a majority victory (more than half the
        judges, {result.majority} of {judgeCount}).
      </Text>
      <Table.ScrollContainer minWidth={400}>
        <Table withColumnBorders fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={30}>#</Table.Th>
              <Table.Th>{entryHeading[event.entryType]}</Table.Th>
              {event.judgeIds.map((j, ji) => (
                <Table.Th key={j} ta="center">
                  J{ji + 1}
                </Table.Th>
              ))}
              <Table.Th ta="center">Total sums</Table.Th>
              {entryIds.map((e, i) => (
                <Table.Th key={e} ta="center" title={label(e)}>
                  v{i + 1}
                </Table.Th>
              ))}
              <Table.Th ta="center" title="Majority victories">
                MV
              </Table.Th>
              <Table.Th ta="center" title="Total victories">
                TV
              </Table.Th>
              <Table.Th ta="center">Place</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {entryIds.map((e, i) => {
              const o = rowOf.get(e)!;
              return (
                <Table.Tr key={e}>
                  <Table.Td c="dimmed">{i + 1}</Table.Td>
                  <Table.Td>{label(e)}</Table.Td>
                  {o.judgeSums.map((s, ji) => (
                    <Table.Td key={ji} ta="center">
                      {formatTenths(s)}
                    </Table.Td>
                  ))}
                  <Table.Td ta="center" fw={600}>
                    {formatTenths(o.totalTenths)}
                  </Table.Td>
                  {entryIds.map((other) => {
                    const v = result.victories.get(e)!.get(other);
                    const majority = v !== undefined && v * 2 > judgeCount;
                    return (
                      <Table.Td
                        key={other}
                        ta="center"
                        fw={majority ? 700 : undefined}
                        c={majority ? undefined : 'dimmed'}
                      >
                        {v === undefined ? '—' : formatVictories(v)}
                      </Table.Td>
                    );
                  })}
                  <Table.Td ta="center" fw={600}>
                    {formatVictories(o.majorityVictories)}
                  </Table.Td>
                  <Table.Td ta="center">{formatVictories(o.totalVictories)}</Table.Td>
                  <Table.Td ta="center" fw={700}>
                    {o.place}
                    {o.tied && '='}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
