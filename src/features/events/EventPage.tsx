import { Anchor, Breadcrumbs, Container, Group, Loader, Tabs, Text, Title, Badge } from '@mantine/core';
import { Link, useNavigate, useParams } from 'react-router';
import { useCompetition, useEvent } from '../../app/data';
import { entryTypeLabel } from '../../db/repo';
import { ResultsTab } from '../results/ResultsTab';
import { ScoringTab } from '../scoring/ScoringTab';
import { EntriesTab } from './EntriesTab';
import { EventJudgesTab } from './EventJudgesTab';
import { EventSetupTab } from './EventSetupTab';
import { StatusBadge } from './StatusBadge';

export function EventPage() {
  const { compId, eventId, tab = 'setup' } = useParams() as { compId: string; eventId: string; tab?: string };
  const competition = useCompetition(compId);
  const event = useEvent(eventId);
  const navigate = useNavigate();

  if (event === undefined || competition === undefined) return <Loader />;
  if (!event || !competition) return <Text>Event not found.</Text>;

  return (
    <Container size="xl">
      <Breadcrumbs mb="xs">
        <Anchor component={Link} to="/" size="sm">
          Competitions
        </Anchor>
        <Anchor component={Link} to={`/c/${compId}`} size="sm">
          {competition.name}
        </Anchor>
        <Text size="sm">{event.name}</Text>
      </Breadcrumbs>
      <Group mb="md" gap="sm">
        <Title order={2}>{event.name}</Title>
        <Badge variant="light">{entryTypeLabel[event.entryType]}</Badge>
        <StatusBadge status={event.status} />
      </Group>
      <Tabs
        value={tab}
        onChange={(v) => navigate(`/c/${compId}/e/${eventId}/${v}`, { replace: true })}
        keepMounted={false}
      >
        <Tabs.List mb="md">
          <Tabs.Tab value="setup">Setup</Tabs.Tab>
          <Tabs.Tab value="entries">Entries</Tabs.Tab>
          <Tabs.Tab value="judges">Judges</Tabs.Tab>
          <Tabs.Tab value="scoring">Scoring</Tabs.Tab>
          <Tabs.Tab value="results">Results</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="setup">
          <EventSetupTab event={event} />
        </Tabs.Panel>
        <Tabs.Panel value="entries">
          <EntriesTab event={event} />
        </Tabs.Panel>
        <Tabs.Panel value="judges">
          <EventJudgesTab event={event} />
        </Tabs.Panel>
        <Tabs.Panel value="scoring">
          <ScoringTab event={event} />
        </Tabs.Panel>
        <Tabs.Panel value="results">
          <ResultsTab event={event} competition={competition} />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
