import {
  ActionIcon,
  Anchor,
  Breadcrumbs,
  Button,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
  Tabs,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconChevronDown, IconDownload, IconPencil, IconPrinter } from '@tabler/icons-react';
import { printJudgeSheets, printResults } from '../../pdf/actions';
import type { ResultsStyle } from '../../pdf/documents';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { useCompetition } from '../../app/data';
import { updateCompetition } from '../../db/repo';
import { CompetitionDetailsForm } from './CompetitionDetailsForm';
import { useExportCompetition } from './useExportCompetition';

const TABS = [
  { value: 'events', label: 'Events' },
  { value: 'skaters', label: 'Skaters' },
  { value: 'judges', label: 'Judges' },
  { value: 'dances', label: 'Dances' },
  { value: 'settings', label: 'Settings' },
];

export function CompetitionLayout() {
  const { compId } = useParams();
  const competition = useCompetition(compId);
  const navigate = useNavigate();
  const location = useLocation();
  const exportCompetition = useExportCompetition();
  const [editing, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const current = location.pathname.split('/')[3] || 'events';

  if (competition === undefined) return <Loader />;
  if (competition === null) return <Text>Competition not found.</Text>;

  const printAllResults = async (style: ResultsStyle) => {
    const { complete, total } = await printResults(
      { competitionId: competition.id },
      competition.name,
      style,
    );
    if (complete < total)
      notifications.show({ message: `${complete} of ${total} events are complete and included.` });
  };

  return (
    <Container size="lg">
      <Breadcrumbs mb="xs">
        <Anchor component={Link} to="/" size="sm">
          Competitions
        </Anchor>
        <Text size="sm">{competition.name}</Text>
      </Breadcrumbs>
      <Group justify="space-between" mb="md">
        <div>
          <Group gap="xs" wrap="nowrap">
            <Title order={2}>{competition.name}</Title>
            <Tooltip label="Edit competition details">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={openEdit}
                aria-label="Edit competition details"
              >
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Text size="sm" c="dimmed">
            {[competition.date && new Date(competition.date).toLocaleDateString(), competition.venue]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </div>
        <Group>
          <Menu position="bottom-end">
            <Menu.Target>
              <Button
                variant="default"
                leftSection={<IconPrinter size={16} />}
                rightSection={<IconChevronDown size={14} />}
              >
                Print
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                onClick={() => printJudgeSheets({ competitionId: competition.id }, competition.name)}
              >
                Judge sheets — all events
              </Menu.Item>
              <Menu.Item onClick={() => printAllResults('standard')}>Results — all complete events</Menu.Item>
              <Menu.Item onClick={() => printAllResults('withMarks')}>
                Results with marks — all complete events
              </Menu.Item>
              <Menu.Item onClick={() => printAllResults('guest')}>
                Results for guest judges (placings only) — all complete events
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button
            variant="default"
            leftSection={<IconDownload size={16} />}
            onClick={() => exportCompetition(competition.id)}
          >
            Export file
          </Button>
        </Group>
      </Group>
      <Tabs value={current} onChange={(v) => navigate(`/c/${compId}/${v === 'events' ? '' : v}`)} mb="md">
        <Tabs.List>
          {TABS.map((t) => (
            <Tabs.Tab key={t.value} value={t.value}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      <Outlet />
      <Modal opened={editing} onClose={closeEdit} title="Edit competition details">
        <CompetitionDetailsForm
          initial={{ name: competition.name, date: competition.date, venue: competition.venue }}
          submitLabel="Save"
          onSubmit={async (values) => {
            await updateCompetition(competition.id, values);
            closeEdit();
            notifications.show({ color: 'green', message: 'Competition details saved' });
          }}
        />
      </Modal>
    </Container>
  );
}
