import { Card, Loader, Progress, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import {
  IconClipboardList,
  IconMedal,
  IconShield,
  IconTrophy,
  IconUsers,
  IconFlame,
  IconUserStar,
} from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { useSkaters } from '../../app/data';
import { loadCompetitionEvents } from '../../pdf/loadEvent';
import { ordinalLabel } from '../../scoring/rules';
import { computeCompetitionStats } from './computeStats';
import classes from './StatsTab.module.css';

interface MedalCounts {
  gold: number;
  silver: number;
  bronze: number;
}

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
  const clubMedals = stats.medals.map((m) => ({ ...m, key: m.club, name: m.club }));
  const topSkaters = stats.skaterMedals.slice(0, 10);

  return (
    <Stack gap="lg" mt="md" className={classes.root}>
      <Text c="dimmed" size="sm">
        Based on {stats.eventsCounted} of {stats.eventsTotal} events — those with every mark entered.
      </Text>

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Tile label="Events" value={stats.eventsCounted} icon={<IconTrophy size={20} />} />
        <Tile label="Entries" value={stats.entries} icon={<IconClipboardList size={20} />} />
        <Tile label="Skaters" value={stats.skaters} icon={<IconUsers size={20} />} />
        <Tile label="Clubs" value={stats.clubs} icon={<IconShield size={20} />} />
      </SimpleGrid>

      <Section title="Club medal table" icon={<IconMedal size={26} />}>
        <Podium rows={clubMedals} />
        <MedalTable nameHeader="Club" rows={clubMedals} />
        <Text size="xs" c="dimmed">
          A place shared under rule 8 gives each skater who shares it that place’s medal.
        </Text>
      </Section>

      {topSkaters.length > 0 && (
        <Section title="Skater medal table" icon={<IconUserStar size={26} />}>
          <MedalTable nameHeader="Skater" rows={topSkaters.map((m) => ({ ...m, key: m.id, sub: m.club }))} />
          <Text size="xs" c="dimmed">
            The ten skaters with the most medals. Each member of a pair or team gets its medal.
          </Text>
        </Section>
      )}

      <Section title="Entries per club" icon={<IconClipboardList size={26} />}>
        <Table.ScrollContainer minWidth={420}>
          <Table verticalSpacing="sm">
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
                  <Table.Td className={classes.name}>{c.club}</Table.Td>
                  <Table.Td ta="right" className={classes.total}>
                    {c.entries}
                  </Table.Td>
                  <Table.Td ta="right">{c.skaters}</Table.Td>
                  <Table.Td>
                    <Progress value={(100 * c.entries) / maxEntries} size="lg" color="medal.5" />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Section>

      {busiest.length > 0 && (
        <Section title="Busiest skaters" icon={<IconFlame size={26} />}>
          <Table.ScrollContainer minWidth={420}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Skater</Table.Th>
                  <Table.Th ta="right">Events</Table.Th>
                  <Table.Th ta="right">Best place</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {busiest.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td>
                      <div className={classes.name}>{s.name}</div>
                      <div className={classes.sub}>{s.club}</div>
                    </Table.Td>
                    <Table.Td ta="right" className={classes.total}>
                      {s.events}
                    </Table.Td>
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

function Tile({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className={classes.tile}>
      <span className={classes.tileIcon}>{icon}</span>
      <span className={classes.tileValue}>{value}</span>
      <span className={classes.tileLabel}>{label}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card withBorder padding="md">
      <Stack gap="xs">
        <div className={classes.heading}>
          <span className={classes.headingIcon}>{icon}</span>
          {title}
        </div>
        {children}
      </Stack>
    </Card>
  );
}

const MEDALS = [
  { key: 'gold', label: 'Gold', className: classes.gold },
  { key: 'silver', label: 'Silver', className: classes.silver },
  { key: 'bronze', label: 'Bronze', className: classes.bronze },
] as const;

/** Medal icon in its metal colour. */
function Medal({ kind, size = 20 }: { kind: (typeof MEDALS)[number]; size?: number }) {
  return <IconMedal size={size} className={kind.className} aria-label={kind.label} />;
}

/** Rank of each row, which must already be sorted by gold, then silver, then bronze; equal records share a rank. */
function medalRanks(rows: MedalCounts[]): number[] {
  const ranks: number[] = [];
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    const same = prev && prev.gold === r.gold && prev.silver === r.silver && prev.bronze === r.bronze;
    ranks.push(same ? ranks[i - 1]! : i + 1);
  });
  return ranks;
}

/** The top three as a podium, second place on the left and third on the right. */
function Podium({ rows }: { rows: (MedalCounts & { key: string; name: string })[] }) {
  const ranks = medalRanks(rows);
  const top = rows.slice(0, 3).map((r, i) => ({ ...r, rank: Math.min(ranks[i]!, 3) }));
  // Winner in the middle: [2nd, 1st, 3rd], dropping places that don't exist.
  const order = [top[1], top[0], top[2]].filter((r) => r !== undefined);
  return (
    <div className={classes.podium} role="img" aria-label={`Top clubs: ${top.map((r) => r.name).join(', ')}`}>
      {order.map((r) => (
        <div key={r.key} className={classes.step}>
          <div className={classes.stepName}>{r.name}</div>
          <div className={classes.stepMedals}>
            {MEDALS.map((m) => (
              <span key={m.key} className={`${classes.stepCount} ${r[m.key] ? m.className : classes.zero}`}>
                <IconMedal size={16} />
                {r[m.key]}
              </span>
            ))}
          </div>
          <div className={`${classes.block} ${classes[`block${r.rank}`]}`}>{r.rank}</div>
        </div>
      ))}
    </div>
  );
}

function MedalTable({
  nameHeader,
  rows,
}: {
  nameHeader: string;
  rows: (MedalCounts & { key: string; name: string; sub?: string })[];
}) {
  const ranks = medalRanks(rows);

  return (
    <Table.ScrollContainer minWidth={440}>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={44} />
            <Table.Th>{nameHeader}</Table.Th>
            {MEDALS.map((m) => (
              <Table.Th key={m.key} ta="right">
                <Medal kind={m} size={30} />
              </Table.Th>
            ))}
            <Table.Th ta="right">Total</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r, i) => {
            const rank = ranks[i]!;
            return (
              <Table.Tr key={r.key} className={rank === 1 ? classes.leader : undefined}>
                <Table.Td>
                  <span className={`${classes.rank} ${rank <= 3 ? classes[`rank${rank}`] : ''}`}>{rank}</span>
                </Table.Td>
                <Table.Td>
                  <div className={classes.name}>{r.name}</div>
                  {r.sub && <div className={classes.sub}>{r.sub}</div>}
                </Table.Td>
                {MEDALS.map((m) => (
                  <Table.Td key={m.key} ta="right">
                    <span className={`${classes.count} ${r[m.key] ? m.className : classes.zero}`}>
                      {r[m.key] || '–'}
                    </span>
                  </Table.Td>
                ))}
                <Table.Td ta="right" className={classes.total}>
                  {r.gold + r.silver + r.bronze}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
