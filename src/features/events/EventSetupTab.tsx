import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router';
import { deleteEvent, marksAffectedByEventChange, updateEvent } from '../../db/repo';
import type { CompEvent } from '../../domain/types';
import { confirmMarkLoss } from './confirmMarkLoss';
import { EventDetailsForm } from './EventDetailsForm';

export function EventSetupTab({ event }: { event: CompEvent }) {
  const navigate = useNavigate();

  const save = async (values: Parameters<typeof updateEvent>[1]) => {
    const lost = await marksAffectedByEventChange(event.id, values);
    confirmMarkLoss(lost, 'Removing dances', async () => {
      await updateEvent(event.id, values);
      notifications.show({ color: 'green', message: 'Event saved' });
    });
  };

  const remove = () =>
    modals.openConfirmModal({
      title: 'Delete event',
      children: <Text size="sm">Delete “{event.name}” with all its entries and marks?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await deleteEvent(event.id);
        navigate(`/c/${event.competitionId}`);
      },
    });

  return (
    <Stack maw={640}>
      <Card withBorder>
        <EventDetailsForm
          key={event.id}
          competitionId={event.competitionId}
          initial={{
            name: event.name,
            entryType: event.entryType,
            compulsoryDanceIds: event.compulsoryDanceIds,
            hasFreeDance: event.hasFreeDance,
          }}
          submitLabel="Save"
          onSubmit={save}
        />
      </Card>
      <Card withBorder>
        <Title order={5} c="red">
          Danger zone
        </Title>
        <Group justify="space-between" mt="sm">
          <Text size="sm">Delete this event, its entries and marks.</Text>
          <Button color="red" variant="light" onClick={remove}>
            Delete event
          </Button>
        </Group>
      </Card>
    </Stack>
  );
}
