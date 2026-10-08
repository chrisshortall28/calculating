import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  MultiSelect,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconFileText, IconTrash, IconTrophy } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCompetition, useEvents, useSkaters } from '../../app/data';
import {
  buildCupStandings,
  categoryLabel,
  CUP_CATEGORIES,
  CUP_ROLES,
  cupTieNotes,
  type CupPart,
  type CupRanked,
} from '../../cup/combinedCup';
import { cupEventsFromData } from '../../cup/fromEvents';
import { updateCombinedCup } from '../../db/repo';
import type { CombinedCupConfig, CupCategory, CupRole } from '../../domain/types';
import { printCombinedCup } from '../../pdf/actions';
import { loadCompetitionEvents } from '../../pdf/loadEvent';
import { ordinalLabel } from '../../scoring';

// Mix & Match is a team event, so it is only offered for events entered as a team.
const roleOptions = (entryType: string) => [
  { value: 'none', label: 'Not counted' },
  ...CUP_ROLES.filter((r) => r.value !== 'mixmatch' || entryType === 'team'),
];

export function CombinedCupTab() {
  const { compId } = useParams() as { compId: string };
  const navigate = useNavigate();
  const competition = useCompetition(compId);
  const events = useEvents(compId);
  const skaters = useSkaters(compId);
  const data = useLiveQuery(() => loadCompetitionEvents(compId), [compId]);
  const [busy, setBusy] = useState(false);
  const cup = competition?.combinedCup;

  const standings = useMemo(
    () => (cup && data ? buildCupStandings(cup, cupEventsFromData(cup, data)) : undefined),
    [cup, data],
  );

  if (!competition || !events || !skaters) return null;
  if (!cup) return <Alert color="gray">Nothing here.</Alert>;

  const skaterMap = new Map(skaters.map((s) => [s.id, s]));
  const nameOf = (id: string) => skaterMap.get(id)?.name ?? '?';
  const save = (patch: Partial<CombinedCupConfig>) => updateCombinedCup(compId, { ...cup, ...patch });
  // Entrants whose skater has since been deleted are ignored.
  const entrants = cup.entrants.filter((e) => skaterMap.has(e.skaterId));
  const taggedEvents = events.filter((e) => cup.eventRoles[e.id]);

  const setRole = (eventId: string, role: CupRole | null) => {
    const eventRoles = { ...cup.eventRoles };
    if (role) eventRoles[eventId] = role;
    else delete eventRoles[eventId];
    return save({ eventRoles });
  };

  const autoAssign = () =>
    save({
      eventRoles: Object.fromEntries(
        events.flatMap((e) => {
          const role: CupRole | undefined =
            e.entryType === 'solo'
              ? 'solo'
              : e.entryType === 'duo' || e.entryType === 'couples'
                ? 'duo'
                : e.entryType === 'team'
                  ? 'team'
                  : undefined;
          return role ? [[e.id, role]] : [];
        }),
      ),
    });

  const turnOff = () =>
    modals.openConfirmModal({
      title: 'Turn off The Combined Cup',
      children: (
        <Text size="sm">
          This removes the Combined Cup entrants and categories from this competition. Events and marks are
          not affected.
        </Text>
      ),
      labels: { confirm: 'Turn off', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await updateCombinedCup(compId, undefined);
        navigate(`/c/${compId}`);
      },
    });

  const download = async () => {
    setBusy(true);
    try {
      await printCombinedCup(competition.id, competition.name);
    } catch (e) {
      notifications.show({ color: 'red', title: 'PDF failed', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const available = skaters
    .filter((s) => !entrants.some((e) => e.skaterId === s.id))
    .map((s) => ({ value: s.id, label: s.club ? `${s.name} — ${s.club}` : s.name }));

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>The Combined Cup</Title>
          <Text size="sm" c="dimmed" maw={640}>
            Entrants score points for their placing in their solo dance, their duo dance, their best team
            event and Mix & Match: 5 points for 1st down to 1 point for 5th. The highest total in each
            category wins; ties on points go to the Mix and Match result, then solo, duo and team.
          </Text>
        </div>
        <Button
          leftSection={<IconFileText size={16} />}
          loading={busy}
          disabled={entrants.length === 0}
          onClick={download}
        >
          Results PDF
        </Button>
      </Group>

      <Card withBorder>
        <Group justify="space-between" mb="xs">
          <Title order={4}>Events that count</Title>
          <Button variant="light" size="xs" onClick={autoAssign}>
            Auto-assign by event type
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">
          Choose which events count and as what. Only a skater’s best team event scores, so leave out the team
          events that don’t count (such as quartet and show).
        </Text>
        {events.length === 0 ? (
          <Text size="sm" c="dimmed">
            This competition has no events yet.
          </Text>
        ) : (
          <Table verticalSpacing="xs">
            <Table.Tbody>
              {events.map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td>{e.name}</Table.Td>
                  <Table.Td w={180}>
                    <Select
                      size="xs"
                      aria-label={`Combined Cup role of ${e.name}`}
                      data={roleOptions(e.entryType)}
                      value={cup.eventRoles[e.id] ?? 'none'}
                      allowDeselect={false}
                      onChange={(v) => setRole(e.id, v === 'none' || !v ? null : (v as CupRole))}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Card withBorder>
        <Title order={4} mb="xs">
          Entrants
        </Title>
        <MultiSelect
          aria-label="Add entrants"
          placeholder="Add skaters to The Combined Cup"
          data={available}
          value={[]}
          searchable
          clearable={false}
          mb="sm"
          onChange={(ids) =>
            save({
              entrants: [
                ...cup.entrants,
                ...ids.map((skaterId) => ({ skaterId, category: 'newcomer-novice' as CupCategory })),
              ],
            })
          }
        />
        {entrants.length > 0 && (
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Skater</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {entrants.map((en) => (
                <Table.Tr key={en.skaterId}>
                  <Table.Td>
                    {nameOf(en.skaterId)}
                    <Text span size="xs" c="dimmed">
                      {' '}
                      {skaterMap.get(en.skaterId)?.club}
                    </Text>
                  </Table.Td>
                  <Table.Td w={200}>
                    <Select
                      size="xs"
                      aria-label={`Category of ${nameOf(en.skaterId)}`}
                      data={CUP_CATEGORIES}
                      value={en.category}
                      allowDeselect={false}
                      onChange={(v) =>
                        v &&
                        save({
                          entrants: cup.entrants.map((x) =>
                            x.skaterId === en.skaterId ? { ...x, category: v as CupCategory } : x,
                          ),
                        })
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Remove ${nameOf(en.skaterId)}`}
                      onClick={() =>
                        save({ entrants: cup.entrants.filter((x) => x.skaterId !== en.skaterId) })
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {standings?.provisional && (
        <Alert color="yellow" variant="light">
          Some events that entrants are in aren’t complete yet, so these results can still change.
        </Alert>
      )}
      {taggedEvents.length === 0 && entrants.length > 0 && (
        <Alert color="blue" variant="light">
          No events are set to count yet. Choose them under “Events that count”.
        </Alert>
      )}

      {standings?.categories.map((c) => (
        <Card key={c.category} withBorder>
          <Group justify="space-between" mb="xs">
            <Title order={4}>{categoryLabel(c.category)}</Title>
          </Group>
          {c.ranked.length === 0 ? (
            <Text size="sm" c="dimmed">
              No entrants in this category.
            </Text>
          ) : (
            <Stack gap="sm">
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <IconTrophy size={20} color="var(--mantine-color-yellow-6)" style={{ flex: 'none' }} />
                <Text fw={600}>
                  {c.winners.length > 1 ? 'Joint winners' : 'Winner'}: {c.winners.map(nameOf).join(' & ')}
                  {standings.provisional && (
                    <Text span c="dimmed" fw={400}>
                      {' '}
                      (provisional)
                    </Text>
                  )}
                </Text>
              </Group>
              <Table.ScrollContainer minWidth={640}>
                <Table withColumnBorders fz="sm" verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={50}>Rank</Table.Th>
                      <Table.Th>Skater</Table.Th>
                      <Table.Th>Solo dance</Table.Th>
                      <Table.Th>Duo dance</Table.Th>
                      <Table.Th>Team</Table.Th>
                      <Table.Th>Mix & Match</Table.Th>
                      <Table.Th ta="center">Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {c.ranked.map((r) => (
                      <RankedRow
                        key={r.skaterId}
                        r={r}
                        name={nameOf(r.skaterId)}
                        club={skaterMap.get(r.skaterId)?.club}
                      />
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              {cupTieNotes(c, nameOf).map((note) => (
                <Text key={note} size="xs" c="dimmed">
                  {note}
                </Text>
              ))}
            </Stack>
          )}
        </Card>
      ))}

      <Group justify="flex-end">
        <Button variant="subtle" color="red" size="xs" onClick={turnOff}>
          Turn off The Combined Cup
        </Button>
      </Group>
    </Stack>
  );
}

function RankedRow({ r, name, club }: { r: CupRanked; name: string; club?: string }) {
  return (
    <Table.Tr>
      <Table.Td fw={700}>
        {r.rank}
        {r.tied && '='}
      </Table.Td>
      <Table.Td>
        {name}
        {club && (
          <Text size="xs" c="dimmed">
            {club}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <PartCell part={r.solo} />
      </Table.Td>
      <Table.Td>
        <PartCell part={r.duo} />
      </Table.Td>
      <Table.Td>
        <PartCell part={r.team} />
      </Table.Td>
      <Table.Td>
        <PartCell part={r.mixmatch} />
      </Table.Td>
      <Table.Td ta="center" fw={700}>
        {r.total}
      </Table.Td>
    </Table.Tr>
  );
}

/** What counted for one part (event, placing, points), then any events that were disregarded. */
function PartCell({ part }: { part: CupPart }) {
  const { counted, notCounted, pending } = part;
  if (!counted && !notCounted.length && !pending.length) return <Text c="dimmed">—</Text>;
  const pts = (n: number) => `${n} ${n === 1 ? 'pt' : 'pts'}`;
  return (
    <Stack gap={2}>
      {counted && (
        <div>
          <Text size="sm" fw={600}>
            {ordinalLabel(counted.place)}
            {counted.tied && '='} · {pts(counted.points)}
          </Text>
          <Text size="xs" c="dimmed">
            {counted.eventName}
          </Text>
        </div>
      )}
      {notCounted.map((p) => (
        <Text key={p.eventId} size="xs" c="dimmed" title="Only the best result in this part scores">
          <Text span inherit td="line-through">
            {p.eventName}: {ordinalLabel(p.place)}
            {p.tied && '='} · {pts(p.points)}
          </Text>{' '}
          (not counted)
        </Text>
      ))}
      {pending.map((name) => (
        <Text key={name} size="xs" c="yellow.8">
          {name}: in progress
        </Text>
      ))}
    </Stack>
  );
}
