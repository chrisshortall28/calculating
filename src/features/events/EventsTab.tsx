import { Badge, Button, Card, Group, Modal, Paper, Progress, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router';
import { useDances, useEvents } from '../../app/data';
import { SortableList } from '../../app/SortableList';
import { db } from '../../db/db';
import { createEvent, entryTypeLabel, reorderEvents } from '../../db/repo';
import { byId } from '../../domain/entryName';
import { eventSegments } from '../../domain/segments';
import { EventDetailsForm } from './EventDetailsForm';
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
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          {events?.length ?? 0} events · drag to reorder
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          New event
        </Button>
      </Group>

      {events?.length === 0 && (
        <Card withBorder p="xl" ta="center">
          <Text c="dimmed">No events yet.</Text>
        </Card>
      )}

      <SortableList
        items={events ?? []}
        onReorder={reorderEvents}
        renderItem={(ev, index, handle) => {
          const segments = eventSegments(ev, dances);
          const entryCount = counts?.entries.get(ev.id) ?? 0;
          const markCount = counts?.marks.get(ev.id) ?? 0;
          const expected =
            entryCount * ev.judgeIds.length * segments.reduce((s, g) => s + g.markKeys.length, 0);
          return (
            <Paper withBorder p="sm" mb={6}>
              <Group wrap="nowrap" gap="sm">
                {handle}
                <Text c="dimmed" w={28} ta="right" size="sm">
                  {index + 1}
                </Text>
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs">
                    <Text
                      fw={600}
                      component={Link}
                      to={`/c/${compId}/e/${ev.id}`}
                      style={{ color: 'inherit' }}
                    >
                      {ev.name}
                    </Text>
                    <Badge variant="light" size="sm">
                      {entryTypeLabel[ev.entryType]}
                    </Badge>
                    <StatusBadge status={ev.status} />
                  </Group>
                  <Text size="xs" c="dimmed" truncate>
                    {segments.map((s) => s.name).join(' · ') || 'No dances'}
                  </Text>
                </Stack>
                <Text size="sm" c="dimmed" w={90}>
                  {entryCount} entries
                </Text>
                <Text size="sm" c={ev.judgeIds.length ? 'dimmed' : 'orange'} w={80}>
                  {ev.judgeIds.length} judges
                </Text>
                <Stack gap={2} w={110}>
                  <Progress
                    value={expected ? (100 * markCount) / expected : 0}
                    size="sm"
                    color={markCount === expected && expected ? 'green' : 'blue'}
                  />
                  <Text size="xs" c="dimmed">
                    {markCount}/{expected} marks
                  </Text>
                </Stack>
                <Button size="xs" variant="light" onClick={() => navigate(`/c/${compId}/e/${ev.id}/scoring`)}>
                  Score
                </Button>
              </Group>
            </Paper>
          );
        }}
      />

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
