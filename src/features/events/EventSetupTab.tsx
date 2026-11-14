import { Alert, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router';
import { deleteEvent, marksAffectedByEventChange, updateEvent } from '../../db/repo';
import type { CompEvent } from '../../domain/types';
import { confirmMarkLoss } from './confirmMarkLoss';
import { isFinal } from './EditLock';
import { eventTitle } from '../../domain/eventTitle';
import { EventDetailsForm } from './EventDetailsForm';

export function EventSetupTab({ event }: { event: CompEvent }) {
  const navigate = useNavigate();

  const locked = isFinal(event);

  const save = async (values: Parameters<typeof updateEvent>[1]) => {
    // A final event keeps its parts, entry type and settings: only its number and name can change.
    if (locked) {
      await updateEvent(event.id, { name: values.name, number: values.number });
      notifications.show({ color: 'green', message: 'Event saved' });
      return;
    }
    const lost = await marksAffectedByEventChange(event.id, values);
    confirmMarkLoss(
      lost,
      event.discipline === 'figures' ? 'Removing figures or programmes' : 'Removing dances',
      async () => {
        await updateEvent(event.id, values);
        notifications.show({ color: 'green', message: 'Event saved' });
      },
    );
  };

  const remove = () =>
    modals.openConfirmModal({
      title: 'Delete event',
      children: <Text size="sm">Delete “{eventTitle(event)}” with all its entries and marks?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await deleteEvent(event.id);
        navigate(`/c/${event.competitionId}`);
      },
    });

  return (
    <Stack maw={640}>
      {locked && (
        <Alert color="yellow" variant="light" icon={<IconLock size={18} />}>
          This event is marked final, so only its number and name can be changed. Unlock it on the Scoring tab
          to change anything else.
        </Alert>
      )}
      <Card withBorder>
        <EventDetailsForm
          key={event.id}
          competitionId={event.competitionId}
          eventId={event.id}
          initial={{
            name: event.name,
            number: event.number,
            entryType: event.entryType,
            discipline: event.discipline,
            compulsoryDanceIds: event.compulsoryDanceIds,
            hasFreeDance: event.hasFreeDance,
            figures: event.figures,
            hasShort: event.hasShort,
            hasLong: event.hasLong,
            factors: event.factors,
          }}
          submitLabel="Save"
          onSubmit={save}
          lockedExceptName={locked}
        />
      </Card>
      <Card withBorder>
        <Title order={5} c="red">
          Danger zone
        </Title>
        <Group justify="space-between" mt="sm">
          <Text size="sm">
            {locked ? 'Unlock the event to delete it.' : 'Delete this event, its entries and marks.'}
          </Text>
          <Button color="red" variant="light" onClick={remove} disabled={locked}>
            Delete event
          </Button>
        </Group>
      </Card>
    </Stack>
  );
}
