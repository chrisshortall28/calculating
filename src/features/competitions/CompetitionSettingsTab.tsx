import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useNavigate, useParams } from 'react-router';
import { useCompetition } from '../../app/data';
import { deleteCompetition, updateCompetition } from '../../db/repo';
import { CompetitionDetailsForm, detailsOf } from './CompetitionDetailsForm';

export function CompetitionSettingsTab() {
  const { compId } = useParams() as { compId: string };
  const competition = useCompetition(compId);
  const navigate = useNavigate();

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
        <Title order={5} mb="sm">
          Competition details
        </Title>
        <CompetitionDetailsForm
          // Remount when the stored details change (e.g. edited from the header) so the form shows them.
          key={`${competition.name}|${competition.date}|${competition.venue}|${competition.primaryColor}|${competition.secondaryColor}`}
          initial={detailsOf(competition)}
          submitLabel="Save"
          onSubmit={async (values) => {
            await updateCompetition(compId, values);
            notifications.show({ color: 'green', message: 'Competition details saved' });
          }}
        />
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
