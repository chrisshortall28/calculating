import { Badge, Container, Loader, Text } from '@mantine/core';
import { IconAdjustments, IconMusic, IconPencilBolt, IconPodium, IconUsers } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { IconJudge } from '../../app/IconJudge';
import { useCompetition, useDances, useEvent } from '../../app/data';
import { clubColors } from '../../app/clubColors';
import { HeroMeta, HeroTabs, PageHero } from '../../app/PageHero';
import { entryTypeColor } from '../../app/theme';
import { entryTypeLabel } from '../../db/repo';
import { eventSegments } from '../../domain/segments';
import type { CompEvent, Competition } from '../../domain/types';
import { ResultsTab } from '../results/ResultsTab';
import { ScoringTab } from '../scoring/ScoringTab';
import { EntriesTab } from './EntriesTab';
import { EventJudgesTab } from './EventJudgesTab';
import { EventSetupTab } from './EventSetupTab';
import { StatusBadge } from './StatusBadge';

const TABS = [
  { value: 'setup', label: 'Setup', icon: <IconAdjustments size={18} /> },
  { value: 'entries', label: 'Entries', icon: <IconUsers size={18} /> },
  { value: 'judges', label: 'Judges', icon: <IconJudge size={18} /> },
  { value: 'scoring', label: 'Scoring', icon: <IconPencilBolt size={18} /> },
  { value: 'results', label: 'Results', icon: <IconPodium size={18} /> },
];

const PANELS: Record<string, (event: CompEvent, competition: Competition) => ReactNode> = {
  setup: (e) => <EventSetupTab event={e} />,
  entries: (e) => <EntriesTab event={e} />,
  judges: (e) => <EventJudgesTab event={e} />,
  scoring: (e) => <ScoringTab event={e} />,
  results: (e, c) => <ResultsTab event={e} competition={c} />,
};

export function EventPage() {
  const { compId, eventId, tab = 'setup' } = useParams() as { compId: string; eventId: string; tab?: string };
  const competition = useCompetition(compId);
  const event = useEvent(eventId);
  const dances = useDances(compId);
  const navigate = useNavigate();

  if (event === undefined || competition === undefined) return <Loader />;
  if (!event || !competition) return <Text>Event not found.</Text>;

  const segments = eventSegments(event, dances ?? []);
  const panel = PANELS[tab] ?? PANELS.setup!;

  return (
    <>
      <PageHero
        colors={clubColors(competition)}
        size="xl"
        crumbs={[
          { label: 'Competitions', to: '/' },
          { label: competition.name, to: `/c/${compId}` },
          { label: event.name },
        ]}
        title={event.name}
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
          tabs={TABS}
          value={tab}
          onChange={(v) => navigate(`/c/${compId}/e/${eventId}/${v}`, { replace: true })}
        />
      </PageHero>
      <Container size="xl" key={event.id}>
        {panel(event, competition)}
      </Container>
    </>
  );
}
