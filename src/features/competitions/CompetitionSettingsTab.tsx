import { Button, Card, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCompetition } from '../../app/data';
import { deleteCompetition, updateCompetition } from '../../db/repo';

export function CompetitionSettingsTab() {
  const { compId } = useParams() as { compId: string };
  const competition = useCompetition(compId);
  const navigate = useNavigate();
  const form = useForm({ initialValues: { name: '', date: '', venue: '' } });

  useEffect(() => {
    if (competition)
      form.setValues({ name: competition.name, date: competition.date, venue: competition.venue });
  }, [competition?.id]);

  if (!competition) return null;

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: 'Delete competition',
      children: (
        <Text size="sm">
          Permanently delete “{competition.name}” and all its events, entries and marks from this device?
          Export a file first if you may need it again.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await deleteCompetition(compId);
        navigate('/');
      },
    });

  return (
    <Stack maw={520}>
      <Card withBorder>
        <form
          onSubmit={form.onSubmit(async (v) => {
            await updateCompetition(compId, v);
            notifications.show({ color: 'green', message: 'Saved' });
          })}
        >
          <Stack>
            <TextInput label="Name" required {...form.getInputProps('name')} />
            <TextInput label="Date" type="date" {...form.getInputProps('date')} />
            <TextInput label="Venue" {...form.getInputProps('venue')} />
            <Group justify="flex-end">
              <Button type="submit">Save</Button>
            </Group>
          </Stack>
        </form>
      </Card>
      <Card withBorder>
        <Title order={5} c="red">
          Danger zone
        </Title>
        <Group justify="space-between" mt="sm">
          <Text size="sm">Delete this competition from this device.</Text>
          <Button color="red" variant="light" onClick={confirmDelete}>
            Delete
          </Button>
        </Group>
      </Card>
    </Stack>
  );
}
