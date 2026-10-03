import { Badge, Button, Card, Group, Modal, RingProgress, Stack, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconListNumbers, IconPlayerPlayFilled, IconPlus, IconUsers } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router';
import { IconJudge } from '../../app/IconJudge';
import { useDances, useEvents } from '../../app/data';
import { SectionHeader } from '../../app/SectionHeader';
import { SortableList } from '../../app/SortableList';
import { entryTypeColor, statusColor } from '../../app/theme';
import { db } from '../../db/db';
import { createEvent, entryTypeLabel, reorderEvents } from '../../db/repo';
import { byId } from '../../domain/entryName';
import { eventSegments } from '../../domain/segments';
import { EventDetailsForm } from './EventDetailsForm';
import classes from './EventsTab.module.css';
import { StatusBadge } from './StatusBadge';

export function EventsTab() {
  const { compId } = useParams() as { compId: string };
  const navigate = useNavigate();
  const events = useEvents(compId);
  const dances = byId(useDances(compId));
  const [opened, { open, close }] = useDisclosure(false);

  const counts = useLiveQuery(async () => {
    const eventIds = await db.events.where({ competitionId: compId }).primaryKeys();
    const entries = new Map<string, number>();
    const marks = new Map<string, number>();
    await db.entries
      .where('eventId')
      .anyOf(eventIds)
      .each((e) => entries.set(e.eventId, (entries.get(e.eventId) ?? 0) + 1));
    await db.marks
      .where('eventId')
      .anyOf(eventIds)
      .each((m) => marks.set(m.eventId, (marks.get(m.eventId) ?? 0) + 1));
    return { entries, marks };
  }, [compId]);

  return (
    <Stack gap="md">
      <SectionHeader
        title="Events"
        count={events?.length}
        hint="Drag the grip to reorder"
        action={
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            New event
          </Button>
        }
      />

      {events?.length === 0 && (
        <Card withBorder p="xl" ta="center">
          <IconListNumbers size={40} color="var(--mantine-color-gray-5)" style={{ margin: '0 auto' }} />
          <Text fw={600} mt="sm">
            No events yet
          </Text>
          <Text c="dimmed" size="sm">
            Create the first event, then add its entries and judges.
          </Text>
        </Card>
      )}

      <div>
        <SortableList
          items={events ?? []}
          onReorder={reorderEvents}
          renderItem={(ev, _index, handle) => {
            const segments = eventSegments(ev, dances);
            const entryCount = counts?.entries.get(ev.id) ?? 0;
            const markCount = counts?.marks.get(ev.id) ?? 0;
            const expected =
              entryCount * ev.judgeIds.length * segments.reduce((s, g) => s + g.markKeys.length, 0);
            const pct = expected ? Math.round((100 * markCount) / expected) : 0;
            const stripe = `var(--mantine-color-${statusColor[ev.status]}-6)`;
            return (
              <div className={classes.row} style={{ ['--stripe-color' as string]: stripe }}>
                {handle}
                <Stack gap={4} className={classes.info}>
                  <Group gap="xs">
                    <Text component={Link} to={`/c/${compId}/e/${ev.id}`} className={classes.name} truncate>
                      {ev.name}
                    </Text>
                    <Badge variant="light" size="sm" color={entryTypeColor[ev.entryType]}>
                      {entryTypeLabel[ev.entryType]}
                    </Badge>
                    <StatusBadge status={ev.status} />
                  </Group>
                  <Group gap={4}>
                    {segments.length ? (
                      segments.map((s) => (
                        <Badge
                          key={s.id}
                          size="xs"
                          variant="outline"
                          color={s.kind === 'free' ? 'medal.7' : 'navy.5'}
                          tt="none"
                        >
                          {s.name}
                        </Badge>
                      ))
                    ) : (
                      <Text size="xs" c="orange.7">
                        {ev.discipline === 'figures' ? 'No figures or programmes' : 'No dances'}
                      </Text>
                    )}
                  </Group>
                </Stack>
                <div className={classes.actions}>
                  <Tooltip label="Entries">
                    <div className={classes.stat}>
                      <IconUsers size={18} />
                      <span className={classes.statValue}>{entryCount}</span>
                    </div>
                  </Tooltip>
                  <Tooltip label={ev.judgeIds.length ? 'Judges' : 'No judges assigned yet'}>
                    <div className={`${classes.stat} ${ev.judgeIds.length ? '' : classes.warn}`}>
                      <IconJudge size={18} />
                      <span className={classes.statValue}>{ev.judgeIds.length}</span>
                    </div>
                  </Tooltip>
                  <Tooltip label={`${markCount} of ${expected} marks entered`}>
                    <RingProgress
                      size={60}
                      thickness={5}
                      roundCaps
                      sections={[{ value: pct, color: pct === 100 ? 'teal' : 'podium' }]}
                      label={
                        <Text ta="center" size="xs" fw={700}>
                          {pct}%
                        </Text>
                      }
                    />
                  </Tooltip>
                  <Button
                    size="sm"
                    leftSection={<IconPlayerPlayFilled size={14} />}
                    onClick={() => navigate(`/c/${compId}/e/${ev.id}/scoring`)}
                  >
                    View
                  </Button>
                </div>
              </div>
            );
          }}
        />
      </div>

      <Modal opened={opened} onClose={close} title="New event" size="lg">
        <EventDetailsForm
          competitionId={compId}
          submitLabel="Create event"
          onSubmit={async (values) => {
            const id = await createEvent(compId, values);
            close();
            navigate(`/c/${compId}/e/${id}/entries`);
          }}
        />
      </Modal>
    </Stack>
  );
}
