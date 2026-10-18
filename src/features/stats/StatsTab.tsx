import { Badge, Card, Group, Loader, Progress, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useParams } from 'react-router';
import { useSkaters } from '../../app/data';
import { loadCompetitionEvents } from '../../pdf/loadEvent';
import { formatVictories, ordinalLabel, ruleLabel } from '../../scoring/rules';
import { computeCompetitionStats, type WinningMargin } from './computeStats';

const TOP = 5;

export function StatsTab() {
  const { compId } = useParams() as { compId: string };
  const skaters = useSkaters(compId);
  const events = useLiveQuery(() => loadCompetitionEvents(compId), [compId]);
  const stats = useMemo(
    () => (events && skaters ? computeCompetitionStats(events, skaters) : undefined),
    [events, skaters],
  );

  if (!stats) return <Loader />;
  if (stats.eventsCounted === 0)
    return (
      <Text c="dimmed" mt="md">
        Stats appear once an event has all its marks in.
      </Text>
    );

  const maxEntries = Math.max(...stats.clubRows.map((c) => c.entries));
  // Only skaters who skated more than once are worth ranking.
  const busiest = stats.busiest.filter((s) => s.events > 1).slice(0, 10);
  const widest = stats.margins.slice(0, TOP);
  const narrowest = [...stats.margins].reverse().slice(0, TOP);

  return (
    <Stack gap="lg" mt="md">
      <Text c="dimmed" size="sm">
        Based on {stats.eventsCounted} of {stats.eventsTotal} events — those with every mark entered.
      </Text>

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Tile label="Events" value={stats.eventsCounted} />
        <Tile label="Entries" value={stats.entries} />
        <Tile label="Skaters" value={stats.skaters} />
        <Tile label="Clubs" value={stats.clubs} />
      </SimpleGrid>

      <Section title="Medal table">
        <Table.ScrollContainer minWidth={420}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Club</Table.Th>
                <Table.Th ta="right">Gold</Table.Th>
                <Table.Th ta="right">Silver</Table.Th>
                <Table.Th ta="right">Bronze</Table.Th>
                <Table.Th ta="right">Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stats.medals.map((m) => (
                <Table.Tr key={m.club}>
                  <Table.Td>{m.club}</Table.Td>
                  <Table.Td ta="right">{m.gold}</Table.Td>
                  <Table.Td ta="right">{m.silver}</Table.Td>
                  <Table.Td ta="right">{m.bronze}</Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {m.gold + m.silver + m.bronze}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Text size="xs" c="dimmed">
          A place shared under rule 8 gives each skater who shares it that place’s medal.
        </Text>
      </Section>

      <Section title="Entries per club">
        <Table.ScrollContainer minWidth={420}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Club</Table.Th>
                <Table.Th ta="right">Entries</Table.Th>
                <Table.Th ta="right">Skaters</Table.Th>
                <Table.Th w="35%" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stats.clubRows.map((c) => (
                <Table.Tr key={c.club}>
                  <Table.Td>{c.club}</Table.Td>
                  <Table.Td ta="right">{c.entries}</Table.Td>
                  <Table.Td ta="right">{c.skaters}</Table.Td>
                  <Table.Td>
                    <Progress value={(100 * c.entries) / maxEntries} size="sm" />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Section>

      {busiest.length > 0 && (
        <Section title="Busiest skaters">
          <Table.ScrollContainer minWidth={420}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Skater</Table.Th>
                  <Table.Th>Club</Table.Th>
                  <Table.Th ta="right">Events</Table.Th>
                  <Table.Th ta="right">Best place</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {busiest.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td>{s.name}</Table.Td>
                    <Table.Td>{s.club}</Table.Td>
                    <Table.Td ta="right">{s.events}</Table.Td>
                    <Table.Td ta="right">{ordinalLabel(s.bestPlace)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Section>
      )}

      {stats.margins.length > 0 && (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Section title="Biggest winning margins">
            <Margins rows={widest} />
          </Section>
          <Section title="Closest wins">
            <Margins rows={narrowest} />
          </Section>
        </SimpleGrid>
      )}
    </Stack>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <Card withBorder padding="md">
      <Text size="xl" fw={700}>
        {value}
      </Text>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card withBorder padding="md">
      <Stack gap="xs">
        <Title order={4}>{title}</Title>
        {children}
      </Stack>
    </Card>
  );
}

/** Lead over second place in majority victories (the CIPA measure of who won). */
function Margins({ rows }: { rows: WinningMargin[] }) {
  return (
    <Stack gap="xs">
      {rows.map((m) => (
        <Group key={m.eventId} justify="space-between" wrap="nowrap" align="flex-start">
          <div>
            <Text size="sm" fw={500}>
              {m.winner}
            </Text>
            <Text size="xs" c="dimmed">
              {m.eventName}
            </Text>
          </div>
          <Group gap={6} wrap="nowrap">
            {m.rule !== '5' && (
              <Badge variant="light" color="gray">
                Rule {ruleLabel(m.rule)}
              </Badge>
            )}
            <Text size="sm" fw={600}>
              {m.margin === 0 ? 'level' : `+${formatVictories(m.margin)}`}
            </Text>
          </Group>
        </Group>
      ))}
    </Stack>
  );
}
