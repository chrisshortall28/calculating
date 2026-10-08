import { ActionIcon, Button, Container, Loader, Menu, Modal, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarEvent,
  IconChevronDown,
  IconDownload,
  IconListNumbers,
  IconMapPin,
  IconMusic,
  IconPencil,
  IconPrinter,
  IconSettings,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { IconJudge } from '../../app/IconJudge';
import { useCompetition } from '../../app/data';
import { formatLongDate } from '../../app/format';
import { clubColors } from '../../app/clubColors';
import { HeroMeta, HeroTabs, PageHero } from '../../app/PageHero';
import { updateCombinedCup, updateCompetition } from '../../db/repo';
import { printJudgeSheets, printProgramme, printResults } from '../../pdf/actions';
import type { ResultsStyle } from '../../pdf/documents';
import { CompetitionDetailsForm, detailsOf } from './CompetitionDetailsForm';
import { useExportCompetition } from './useExportCompetition';

const CUP_TAB = { value: 'cup', label: 'Combined Cup', icon: <IconTrophy size={18} /> };

const TABS = [
  { value: 'events', label: 'Events', icon: <IconListNumbers size={18} /> },
  { value: 'skaters', label: 'Skaters', icon: <IconUsers size={18} /> },
  { value: 'judges', label: 'Judges', icon: <IconJudge size={18} /> },
  { value: 'dances', label: 'Dances', icon: <IconMusic size={18} /> },
  { value: 'settings', label: 'Settings', icon: <IconSettings size={18} /> },
];

export function CompetitionLayout() {
  const { compId } = useParams();
  const competition = useCompetition(compId);
  const navigate = useNavigate();
  const location = useLocation();
  const exportCompetition = useExportCompetition();
  const [editing, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const current = location.pathname.split('/')[3] || 'events';
  const [searchParams, setSearchParams] = useSearchParams();
  const hasCup = competition?.combinedCup !== undefined;
  const wantsCup = searchParams.has('cup');

  // Opening the competition with the Combined Cup parameter switches the feature on for it.
  useEffect(() => {
    if (!wantsCup || !competition) return;
    if (!hasCup) void updateCombinedCup(competition.id, { eventRoles: {}, entrants: [] });
    setSearchParams(
      (p) => {
        p.delete('cup');
        return p;
      },
      { replace: true },
    );
  }, [wantsCup, hasCup, competition, setSearchParams]);

  if (competition === undefined) return <Loader />;
  if (competition === null) return <Text>Competition not found.</Text>;

  const colors = clubColors(competition);

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
    <>
      <PageHero
        colors={colors}
        crumbs={[{ label: 'Competitions', to: '/competitions' }, { label: competition.name }]}
        title={competition.name}
        titleAddon={
          <Tooltip label="Edit competition details">
            <ActionIcon
              variant="subtle"
              c="var(--club-on-primary)"
              onClick={openEdit}
              aria-label="Edit competition details"
            >
              <IconPencil size={20} />
            </ActionIcon>
          </Tooltip>
        }
        meta={
          <>
            {competition.date && (
              <HeroMeta icon={<IconCalendarEvent size={16} />}>{formatLongDate(competition.date)}</HeroMeta>
            )}
            {competition.venue && <HeroMeta icon={<IconMapPin size={16} />}>{competition.venue}</HeroMeta>}
          </>
        }
        actions={
          <>
            <Menu position="bottom-end">
              <Menu.Target>
                <Button
                  variant="white"
                  color="navy.9"
                  leftSection={<IconPrinter size={16} />}
                  rightSection={<IconChevronDown size={14} />}
                >
                  Print
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => printProgramme(competition.id, competition.name)}>
                  Programme for spectators
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  onClick={() => printJudgeSheets({ competitionId: competition.id }, competition.name)}
                >
                  Judge sheets — all events
                </Menu.Item>
                <Menu.Item onClick={() => printAllResults('standard')}>
                  Results — all complete events
                </Menu.Item>
                <Menu.Item onClick={() => printAllResults('withMarks')}>
                  Results with marks — all complete events
                </Menu.Item>
                <Menu.Item onClick={() => printAllResults('guest')}>
                  Results for guest judges (placings only) — all complete events
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button
              color={colors.secondary}
              autoContrast
              leftSection={<IconDownload size={16} />}
              onClick={() => exportCompetition(competition.id)}
            >
              Export file
            </Button>
          </>
        }
      >
        <HeroTabs
          tabs={hasCup ? [...TABS, CUP_TAB] : TABS}
          value={current}
          onChange={(v) => navigate(`/c/${compId}/${v === 'events' ? '' : v}`)}
        />
      </PageHero>
      <Container size="lg">
        <Outlet />
      </Container>
      <Modal opened={editing} onClose={closeEdit} title="Edit competition details">
        <CompetitionDetailsForm
          initial={detailsOf(competition)}
          submitLabel="Save"
          onSubmit={async (values) => {
            await updateCompetition(competition.id, values);
            closeEdit();
            notifications.show({ color: 'green', message: 'Competition details saved' });
          }}
        />
      </Modal>
    </>
  );
}
