import { ActionIcon, Badge, Container, Loader, Text, Tooltip } from '@mantine/core';
import {
  IconAdjustments,
  IconChevronLeft,
  IconChevronRight,
  IconMusic,
  IconPencilBolt,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { IconJudge } from '../../app/IconJudge';
import { useCompetition, useDances, useEvent, useEvents } from '../../app/data';
import { clubColors } from '../../app/clubColors';
import { HeroMeta, HeroTabs, PageHero } from '../../app/PageHero';
import { entryTypeColor } from '../../app/theme';
import { entryTypeLabel } from '../../db/repo';
import { entryHeading } from '../../domain/entryName';
import { eventSegments } from '../../domain/segments';
import type { CompEvent, Competition, EventStatus } from '../../domain/types';
import { ResultsTab } from '../results/ResultsTab';
import { ScoringTab } from '../scoring/ScoringTab';
import { EntriesTab } from './EntriesTab';
import { EventJudgesTab } from './EventJudgesTab';
import { EventSetupTab } from './EventSetupTab';
import { StatusBadge } from './StatusBadge';

const tabs = (event: CompEvent) => [
  { value: 'setup', label: 'Setup', icon: <IconAdjustments size={18} /> },
  { value: 'entries', label: entryHeading[event.entryType], icon: <IconUsers size={18} /> },
  { value: 'judges', label: 'Judges', icon: <IconJudge size={18} /> },
  { value: 'scoring', label: 'Scoring', icon: <IconPencilBolt size={18} /> },
  { value: 'results', label: 'Results', icon: <IconTrophy size={18} /> },
];

/** The tab an event opens on when the URL doesn't name one, by how far along the event is. */
const STATUS_TAB: Record<EventStatus, string> = {
  setup: 'entries',
  ready: 'judges',
  scoring: 'scoring',
  final: 'results',
};

const PANELS: Record<string, (event: CompEvent, competition: Competition) => ReactNode> = {
  setup: (e) => <EventSetupTab event={e} />,
  entries: (e) => <EntriesTab event={e} />,
  judges: (e) => <EventJudgesTab event={e} />,
  scoring: (e) => <ScoringTab event={e} />,
  results: (e, c) => <ResultsTab event={e} competition={c} />,
};

export function EventPage() {
  const { compId, eventId, tab: tabParam } = useParams() as { compId: string; eventId: string; tab?: string };
  const competition = useCompetition(compId);
  const event = useEvent(eventId);
  const dances = useDances(compId);
  const events = useEvents(compId);
  const navigate = useNavigate();

  if (event === undefined || competition === undefined) return <Loader />;
  if (!event || !competition) return <Text>Event not found.</Text>;

  // Redirect once, so a later status change doesn't switch tabs under the user.
  if (!tabParam) return <Navigate to={`/c/${compId}/e/${eventId}/${STATUS_TAB[event.status]}`} replace />;
  const tab = tabParam;

  const segments = eventSegments(event, dances ?? []);
  const panel = PANELS[tab] ?? PANELS.setup!;
  const index = events?.findIndex((e) => e.id === event.id) ?? -1;
  const prev = index > 0 ? events![index - 1] : undefined;
  const next = index >= 0 ? events![index + 1] : undefined;

  return (
    <>
      <PageHero
        colors={clubColors(competition)}
        size="xl"
        crumbs={[
          { label: 'Competitions', to: '/competitions' },
          { label: competition.name, to: `/c/${compId}` },
          { label: event.name },
        ]}
        title={event.name}
        titleStart={<NeighbourLink event={prev} direction="previous" compId={compId} tab={tab} />}
        titleEnd={<NeighbourLink event={next} direction="next" compId={compId} tab={tab} />}
        badges={
          <>
            <Badge variant="filled" color={entryTypeColor[event.entryType]}>
              {entryTypeLabel[event.entryType]}
            </Badge>
            <StatusBadge status={event.status} />
          </>
        }
        meta={
          <HeroMeta icon={<IconMusic size={16} />}>
            {segments.map((s) => s.name).join(' · ') || 'No dances yet'}
          </HeroMeta>
        }
      >
        <HeroTabs
          tabs={tabs(event)}
          value={tab}
          onChange={(v) => navigate(`/c/${compId}/e/${eventId}/${v}`, { replace: true })}
        />
      </PageHero>
      {/* Scoring can use the whole window, so a large judge panel fits without scrolling. */}
      <Container size="xl" fluid={tab === 'scoring'} key={event.id}>
        {panel(event, competition)}
      </Container>
    </>
  );
}

/** Arrow to the previous/next event in the competition's order, staying on the same tab. */
function NeighbourLink({
  event,
  direction,
  compId,
  tab,
}: {
  event: CompEvent | undefined;
  direction: 'previous' | 'next';
  compId: string;
  tab: string;
}) {
  const Icon = direction === 'previous' ? IconChevronLeft : IconChevronRight;
  const label = event
    ? `${direction === 'previous' ? 'Previous' : 'Next'} event: ${event.name}`
    : `No ${direction} event`;
  const common = { variant: 'subtle', c: 'var(--club-on-primary)', size: 'lg', 'aria-label': label } as const;
  if (!event) {
    return (
      <ActionIcon
        {...common}
        disabled
        // Mantine's disabled style is a light grey block; keep it transparent so it fades into the banner.
        style={{ background: 'transparent', color: 'var(--club-on-primary)', opacity: 0.3 }}
      >
        <Icon size={22} />
      </ActionIcon>
    );
  }
  return (
    <Tooltip label={label}>
      <ActionIcon {...common} component={Link} to={`/c/${compId}/e/${event.id}/${tab}`}>
        <Icon size={22} />
      </ActionIcon>
    </Tooltip>
  );
}
