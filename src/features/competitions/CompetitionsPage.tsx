import { Anchor, Button, Card, Container, FileButton, SimpleGrid, Text } from '@mantine/core';
import { IconFileImport, IconTrophy } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { PageHero } from '../../app/PageHero';
import { db } from '../../db/db';
import { useImportCompetitionFile } from './useImportCompetitionFile';
import { CompetitionCard, NewCompetitionButton, useCompetitionStats } from './CompetitionCard';

export function CompetitionsPage() {
  const competitions = useLiveQuery(() => db.competitions.orderBy('updatedAt').reverse().toArray());
  const stats = useCompetitionStats();

  const onFile = useImportCompetitionFile();

  return (
    <>
      <PageHero
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Competitions' }]}
        title="Competitions"
        meta={<Text size="sm">Set up events, enter judges’ marks and print results — all offline.</Text>}
        actions={
          <>
            <FileButton onChange={onFile} accept=".pod,.json">
              {(props) => (
                <Button variant="white" color="navy.9" leftSection={<IconFileImport size={16} />} {...props}>
                  Import
                </Button>
              )}
            </FileButton>
            <NewCompetitionButton />
          </>
        }
      />
      <Container size="lg">
        {competitions?.length === 0 && (
          <Card withBorder p="xl" ta="center">
            <IconTrophy size={48} color="var(--mantine-color-medal-5)" style={{ margin: '0 auto' }} />
            <Text fw={700} size="lg" mt="sm">
              No competitions yet
            </Text>
            <Text c="dimmed" size="sm">
              Create a competition, or import a competition file.
            </Text>
            <Text c="dimmed" size="sm" maw={520} mx="auto" mt="md">
              Competitions are saved in this browser on this device, not online. To move one to another device
              or browser, export it to a file there and import it here.{' '}
              <Anchor component={Link} to="/guide#your-data" inherit>
                Read more in the guide
              </Anchor>
              .
            </Text>
          </Card>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {competitions?.map((c) => (
            <CompetitionCard key={c.id} competition={c} stats={stats?.get(c.id)} />
          ))}
        </SimpleGrid>
      </Container>
    </>
  );
}
