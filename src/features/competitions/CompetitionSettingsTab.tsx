import { Button, Card, Group, Stack, Switch, Text, Title } from '@mantine/core';
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
        navigate('/competitions');
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
          key={`${competition.name}|${competition.date}|${competition.venue}|${competition.primaryColor}|${competition.secondaryColor}|${competition.welcome}`}
          initial={detailsOf(competition)}
          submitLabel="Save"
          onSubmit={async (values) => {
            await updateCompetition(compId, values);
            notifications.show({ color: 'green', message: 'Competition details saved' });
          }}
        />
      </Card>
      <Card withBorder>
        <Title order={5} mb="sm">
          Skating order
        </Title>
        <Switch
          label="Rotate the start order between compulsory dances and figures"
          description="The field is split into one group per dance or figure, and each one starts with the first skater of its group (8 skaters, 2 dances: #1 then #5). Judge sheets and the scoring grid keep the original order and show who skates first. Each event can override this."
          checked={!!competition.rotateStartOrder}
          onChange={(e) => updateCompetition(compId, { rotateStartOrder: e.currentTarget.checked })}
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
