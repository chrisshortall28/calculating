import {
  Badge,
  Button,
  Card,
  Container,
  FileButton,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconFileImport, IconPlus } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { db } from '../../db/db';
import { createCompetition } from '../../db/repo';
import { importCompetition, parseCompetitionFile, type CompetitionFile } from '../../io/competitionFile';

export function CompetitionsPage() {
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const competitions = useLiveQuery(() => db.competitions.orderBy('updatedAt').reverse().toArray());
  const eventCounts = useLiveQuery(async () => {
    const counts = new Map<string, number>();
    await db.events.each((e) => counts.set(e.competitionId, (counts.get(e.competitionId) ?? 0) + 1));
    return counts;
  });

  const form = useForm({
    initialValues: { name: '', date: new Date().toISOString().slice(0, 10), venue: '' },
    validate: { name: (v) => (v.trim() ? null : 'Name is required') },
  });

  const submit = form.onSubmit(async (values) => {
    const id = await createCompetition({ ...values, name: values.name.trim(), venue: values.venue.trim() });
    close();
    form.reset();
    navigate(`/c/${id}`);
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
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Competitions</Title>
        <Group>
          <FileButton onChange={onFile} accept="application/json,.json">
            {(props) => (
              <Button variant="default" leftSection={<IconFileImport size={16} />} {...props}>
                Import
              </Button>
            )}
          </FileButton>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            New competition
          </Button>
        </Group>
      </Group>

      {competitions?.length === 0 && (
        <Card withBorder p="xl" ta="center">
          <Text c="dimmed">No competitions yet. Create one, or import a competition file.</Text>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        {competitions?.map((c) => (
          <Card
            key={c.id}
            withBorder
            shadow="xs"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/c/${c.id}`)}
          >
            <Text fw={600} size="lg">
              {c.name}
            </Text>
            <Text size="sm" c="dimmed">
              {[c.date && new Date(c.date).toLocaleDateString(), c.venue].filter(Boolean).join(' · ')}
            </Text>
            <Badge mt="sm" variant="light">
              {eventCounts?.get(c.id) ?? 0} events
            </Badge>
          </Card>
        ))}
      </SimpleGrid>

      <Modal opened={opened} onClose={close} title="New competition">
        <form onSubmit={submit}>
          <Stack>
            <TextInput label="Name" data-autofocus required {...form.getInputProps('name')} />
            <TextInput label="Date" type="date" {...form.getInputProps('date')} />
            <TextInput label="Venue" {...form.getInputProps('venue')} />
            <Group justify="flex-end">
              <Button type="submit">Create</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
