import {
  Button,
  Card,
  Container,
  FileButton,
  Group,
  Modal,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconFileImport, IconMapPin, IconPlus, IconTrophy } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router';
import { clubColors, clubVars } from '../../app/clubColors';
import { dateTile } from '../../app/format';
import { PageHero } from '../../app/PageHero';
import classes from './CompetitionsPage.module.css';
import { db } from '../../db/db';
import { createCompetition } from '../../db/repo';
import { CompetitionDetailsForm, emptyCompetitionDetails } from './CompetitionDetailsForm';
import { importCompetition, parseCompetitionFile, type CompetitionFile } from '../../io/competitionFile';

export function CompetitionsPage() {
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const competitions = useLiveQuery(() => db.competitions.orderBy('updatedAt').reverse().toArray());
  const stats = useLiveQuery(async () => {
    const byComp = new Map<string, { events: number; final: number; entries: number }>();
    const compOfEvent = new Map<string, string>();
    const get = (id: string) => {
      let s = byComp.get(id);
      if (!s) byComp.set(id, (s = { events: 0, final: 0, entries: 0 }));
      return s;
    };
    await db.events.each((e) => {
      compOfEvent.set(e.id, e.competitionId);
      const s = get(e.competitionId);
      s.events++;
      if (e.status === 'final') s.final++;
    });
    await db.entries.each((en) => {
      const comp = compOfEvent.get(en.eventId);
      if (comp) get(comp).entries++;
    });
    return byComp;
  });

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
        crumbs={[]}
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
            <Button color="medal.5" c="navy.9" leftSection={<IconPlus size={16} />} onClick={open}>
              New competition
            </Button>
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
          </Card>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {competitions?.map((c) => {
            const s = stats?.get(c.id) ?? { events: 0, final: 0, entries: 0 };
            const tile = dateTile(c.date);
            return (
              <UnstyledButton
                key={c.id}
                component={Link}
                to={`/c/${c.id}`}
                className={classes.card}
                style={clubVars(clubColors(c))}
              >
                <div className={classes.band}>
                  <div className={classes.dateTile}>
                    {tile ? (
                      <>
                        <span className={classes.day}>{tile.day}</span>
                        <span className={classes.month}>{tile.month}</span>
                      </>
                    ) : (
                      <IconTrophy size={22} />
                    )}
                  </div>
                  <Text className={classes.name} lineClamp={2}>
                    {c.name}
                  </Text>
                </div>
                <Stack gap="sm" p="md">
                  <Group gap={6} c="dimmed" wrap="nowrap">
                    <IconMapPin size={16} />
                    <Text size="sm" truncate>
                      {c.venue || 'No venue set'}
                    </Text>
                  </Group>
                  <Group grow gap="xs">
                    <Stat label="Events" value={s.events} />
                    <Stat label="Entries" value={s.entries} />
                    <Stat label="Final" value={`${s.final}/${s.events}`} />
                  </Group>
                  <Progress
                    value={s.events ? (100 * s.final) / s.events : 0}
                    color={s.events && s.final === s.events ? 'teal' : 'medal.5'}
                    size="sm"
                  />
                </Stack>
              </UnstyledButton>
            );
          })}
        </SimpleGrid>
      </Container>

      <Modal opened={opened} onClose={close} title="New competition">
        <CompetitionDetailsForm
          initial={emptyCompetitionDetails()}
          submitLabel="Create"
          onSubmit={async (values) => {
            const id = await createCompetition(values);
            close();
            navigate(`/c/${id}`);
          }}
        />
      </Modal>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={classes.stat}>
      <span className={classes.statValue}>{value}</span>
      <span className={classes.statLabel}>{label}</span>
    </div>
  );
}
