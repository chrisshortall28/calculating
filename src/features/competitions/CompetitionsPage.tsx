import { Anchor, Button, Card, Container, FileButton, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconFileImport, IconTrophy } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router';
import { PageHero } from '../../app/PageHero';
import { db } from '../../db/db';
import { importCompetition, parseCompetitionFile, type CompetitionFile } from '../../io/competitionFile';
import { CompetitionCard, NewCompetitionButton, useCompetitionStats } from './CompetitionCard';

export function CompetitionsPage() {
  const navigate = useNavigate();
  const competitions = useLiveQuery(() => db.competitions.orderBy('updatedAt').reverse().toArray());
  const stats = useCompetitionStats();

  const doImport = async (file: CompetitionFile, mode: 'copy' | 'replace') => {
    const id = await importCompetition(file, mode);
    notifications.show({ color: 'green', message: `Imported “${file.competition.name}”` });
    navigate(`/c/${id}`);
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    let file: CompetitionFile;
    try {
      file = parseCompetitionFile(JSON.parse(await f.text()));
    } catch (e) {
      notifications.show({ color: 'red', title: 'Import failed', message: (e as Error).message });
      return;
    }
    const existing = await db.competitions.get(file.competition.id);
    if (!existing) return doImport(file, 'replace');
    modals.open({
      title: 'Competition already exists',
      children: (
        <Stack>
          <Text size="sm">
            “{existing.name}” is already on this device. Replace it with the file’s contents, or import the
            file as a separate copy?
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                modals.closeAll();
                void doImport(file, 'copy');
              }}
            >
              Import as copy
            </Button>
            <Button
              color="red"
              onClick={() => {
                modals.closeAll();
                void doImport(file, 'replace');
              }}
            >
              Replace
            </Button>
          </Group>
        </Stack>
      ),
    });
  };

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
