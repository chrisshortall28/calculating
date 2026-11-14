import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
  Modal,
  ScrollArea,
  Radio,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFileTypePdf } from '@tabler/icons-react';
import { useState } from 'react';
import { clubColors } from '../../app/clubColors';
import { useDances, useEvents } from '../../app/data';
import { updateCompetition } from '../../db/repo';
import { eventSegments } from '../../domain/segments';
import type { Competition } from '../../domain/types';
import { printJudgeSheets, printProgramme, printResults, printSkatingOrder } from '../../pdf/actions';
import type { ResultsStyle } from '../../pdf/documents';
import { RESULTS } from '../events/EventPdfModal';
import {
  JudgeSheetsPreview,
  ProgrammePreview,
  ResultsPreview,
  SkatingOrderPreview,
} from '../events/PdfPreviews';

type Section = 'programme' | 'order' | 'sheets' | 'results';
type Layout = 'combined' | 'perPart';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The previews are illustrations, so they assume a typical field rather than counting skaters.
const SAMPLE_ENTRIES = 6;

/**
 * Launchpad for a competition's PDFs: the spectators' programme, and skating order, judge sheets and results
 * for all events or the ticked ones. It stays open until dismissed.
 */
export function CompetitionPdfModal({
  competition,
  opened,
  onClose,
}: {
  competition: Competition;
  opened: boolean;
  onClose: () => void;
}) {
  const events = useEvents(competition.id) ?? [];
  const dances = useDances(competition.id);
  const [section, setSection] = useState<Section>('programme');
  /** The unticked events, so events added later start ticked. */
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const [layout, setLayout] = useState<Layout>('combined');
  const [style, setStyle] = useState<ResultsStyle>('standard');
  const [busy, setBusy] = useState(false);
  const saved = competition.welcome ?? '';
  const [welcome, setWelcome] = useState(saved);
  const welcomeDirty = welcome.trim() !== saved.trim();
  const [savingWelcome, setSavingWelcome] = useState(false);
  const saveWelcome = async () => {
    setSavingWelcome(true);
    try {
      await updateCompetition(competition.id, { welcome: welcome.trim() || undefined });
      setWelcome(welcome.trim());
      notifications.show({ color: 'green', message: 'Welcome message saved' });
    } catch (e) {
      notifications.show({ color: 'red', title: 'Could not save', message: (e as Error).message });
    } finally {
      setSavingWelcome(false);
    }
  };
  const close = () => {
    setWelcome(saved); // unsaved changes are dropped
    onClose();
  };

  const chosen = events.filter((e) => !off.has(e.id));
  const target = { competitionId: competition.id, eventIds: new Set(chosen.map((e) => e.id)) };
  const allChosen = chosen.length === events.length;
  const segments = chosen.map((e) => eventSegments(e, dances ?? []));
  const pageCount = segments.reduce((n, s) => n + s.length, 0);
  const previewParts = (segments[0] ?? []).map((s) => s.name);

  // The PDF tab opens synchronously inside the click, before anything is awaited (see src/pdf/pdfmake.ts).
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notifications.show({ color: 'red', title: 'PDF failed', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const createResults = async () => {
    const { complete, total } = (await printResults(target, competition.name, style)) as {
      complete: number;
      total: number;
    };
    if (complete < total)
      notifications.show({ message: `${complete} of ${total} events are complete and included.` });
  };

  const eventsPicker = (
    <Stack gap={6}>
      <Group justify="space-between">
        <Text size="sm" fw={600}>
          Which events ({chosen.length}/{events.length})
        </Text>
        <Group gap="sm">
          <Anchor component="button" type="button" size="xs" onClick={() => setOff(new Set())}>
            All
          </Anchor>
          <Anchor
            component="button"
            type="button"
            size="xs"
            onClick={() => setOff(new Set(events.map((e) => e.id)))}
          >
            None
          </Anchor>
        </Group>
      </Group>
      {/* Scrolls on its own, so a long list of events doesn't make the modal taller. */}
      <ScrollArea.Autosize
        mah={168}
        type="auto"
        offsetScrollbars
        p={8}
        style={{
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-sm)',
        }}
      >
        <Stack gap={6}>
          {events.map((e) => (
            <Checkbox
              key={e.id}
              label={e.name}
              checked={!off.has(e.id)}
              onChange={(ev) => {
                const next = new Set(off);
                if (ev.currentTarget.checked) next.delete(e.id);
                else next.add(e.id);
                setOff(next);
              }}
            />
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );

  const create = (label: string, onClick: () => Promise<unknown>, disabled = false) => (
    <Button
      leftSection={<IconFileTypePdf size={16} />}
      loading={busy}
      disabled={disabled}
      onClick={() => run(onClick)}
    >
      {label}
    </Button>
  );

  const noEvents = (
    <Text size="xs" c="dimmed" ta="center">
      Tick at least one event.
    </Text>
  );

  return (
    <Modal
      opened={opened}
      onClose={close}
      size="xl"
      centered
      title={
        <Group gap="xs">
          <IconFileTypePdf size={20} />
          <Text fw={700}>PDFs for {competition.name}</Text>
        </Group>
      }
    >
      <Stack>
        <SegmentedControl
          fullWidth
          value={section}
          onChange={(v) => setSection(v as Section)}
          data={[
            { value: 'programme', label: 'Programme' },
            { value: 'order', label: 'Skating order' },
            { value: 'sheets', label: 'Judge sheets' },
            { value: 'results', label: 'Results' },
          ]}
        />

        {section === 'programme' && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Stack>
              <Text size="sm">
                A programme for spectators: a cover in the club colours, a welcome page listing the events,
                then the skaters in each event in skating order with its dances.
              </Text>
              <Textarea
                label="Welcome message"
                description="Opens the programme; leave blank lines between paragraphs. Leave empty for a standard welcome."
                autosize
                minRows={4}
                maxRows={10}
                value={welcome}
                onChange={(e) => setWelcome(e.currentTarget.value)}
              />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {welcomeDirty
                    ? 'Save the message to use it in the programme.'
                    : 'The programme covers every event.'}
                </Text>
                <Button
                  variant="light"
                  size="xs"
                  loading={savingWelcome}
                  disabled={!welcomeDirty}
                  onClick={saveWelcome}
                >
                  Save message
                </Button>
              </Group>
            </Stack>
            <ProgrammePreview
              title={competition.name}
              events={events.map((e) => e.name)}
              colors={clubColors(competition)}
            />
          </SimpleGrid>
        )}

        {section === 'order' && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Stack>
              <Text size="sm">
                A page for each dance, figure or programme of the chosen events, listing the skaters in the
                order they skate it, to display at the rink.
              </Text>
              {eventsPicker}
            </Stack>
            <Stack>
              <SkatingOrderPreview
                entries={SAMPLE_ENTRIES}
                parts={(segments[0] ?? []).map((s) => ({ name: s.name, firstNumber: 1, rotates: false }))}
              />
              <Text size="xs" c="dimmed" ta="center">
                {chosen.length === 0
                  ? 'Tick at least one event.'
                  : `${plural(pageCount, 'page')} for ${plural(chosen.length, 'event')}`}
              </Text>
            </Stack>
          </SimpleGrid>
        )}

        {section === 'sheets' && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Stack>
              <Radio.Group value={layout} onChange={(v) => setLayout(v as Layout)} label="Layout">
                <Stack gap={6} mt={6}>
                  <Radio
                    value="combined"
                    label="All parts on one sheet per judge"
                    description="Up to four parts on each landscape sheet, with Total points and Place."
                  />
                  <Radio
                    value="perPart"
                    label="A sheet per dance or figure"
                    description="Separate sheets to hand out one part at a time. No totals."
                  />
                </Stack>
              </Radio.Group>
              {eventsPicker}
            </Stack>
            <Stack>
              <JudgeSheetsPreview parts={previewParts} layout={layout} entries={SAMPLE_ENTRIES} totals />
              <Text size="xs" c="dimmed" ta="center">
                {chosen.length === 0
                  ? 'Tick at least one event.'
                  : `Sheets for each judge and the referee of ${plural(chosen.length, 'event')}`}
              </Text>
            </Stack>
          </SimpleGrid>
        )}

        {section === 'results' && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Stack>
              <Radio.Group value={style} onChange={(v) => setStyle(v as ResultsStyle)} label="Style">
                <Stack gap={6} mt={6}>
                  {RESULTS.map((r) => (
                    <Radio key={r.value} value={r.value} label={r.label} description={r.description} />
                  ))}
                </Stack>
              </Radio.Group>
              {eventsPicker}
              <Alert color="blue" variant="light">
                Only events with every mark entered are included. To create results from just the compulsory
                dances, the free dance, or the figures and programmes that are marked so far, open the event
                and use its PDFs button.
              </Alert>
            </Stack>
            <ResultsPreview style={style} entries={SAMPLE_ENTRIES} judges={3} />
          </SimpleGrid>
        )}

        {section === 'results' && chosen.length === 0 && noEvents}

        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Close
          </Button>
          {section === 'programme' &&
            create('Create programme', () => printProgramme(competition.id, competition.name), welcomeDirty)}
          {section === 'order' &&
            create(
              'Create skating order',
              () =>
                printSkatingOrder(allChosen ? { competitionId: competition.id } : target, competition.name),
              chosen.length === 0,
            )}
          {section === 'sheets' &&
            create(
              'Create judge sheets',
              () =>
                printJudgeSheets(allChosen ? { competitionId: competition.id } : target, competition.name, {
                  layout,
                }),
              chosen.length === 0,
            )}
          {section === 'results' && create('Create results', createResults, chosen.length === 0)}
        </Group>
      </Stack>
    </Modal>
  );
}
