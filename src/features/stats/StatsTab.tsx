import { Card, Loader, Progress, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useParams } from 'react-router';
import { useSkaters } from '../../app/data';
import { loadCompetitionEvents } from '../../pdf/loadEvent';
import { ordinalLabel } from '../../scoring/rules';
import { computeCompetitionStats } from './computeStats';

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
  const topSkaters = stats.skaterMedals.slice(0, 10);

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

      {topSkaters.length > 0 && (
        <Section title="Skater medal table">
          <Table.ScrollContainer minWidth={420}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Skater</Table.Th>
                  <Table.Th>Club</Table.Th>
                  <Table.Th ta="right">Gold</Table.Th>
                  <Table.Th ta="right">Silver</Table.Th>
                  <Table.Th ta="right">Bronze</Table.Th>
                  <Table.Th ta="right">Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {topSkaters.map((m) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>{m.name}</Table.Td>
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
            The ten skaters with the most medals. Each member of a pair or team gets its medal.
          </Text>
        </Section>
      )}

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
