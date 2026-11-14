import { eventTitle } from '../../domain/eventTitle';
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
  Modal,
  Radio,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFileTypePdf } from '@tabler/icons-react';
import { useState } from 'react';
import { useCompetition } from '../../app/data';
import { segmentNoun, type Segment } from '../../domain/segments';
import { effectiveRotate, firstSkaters } from '../../domain/startOrder';
import type { CompEvent } from '../../domain/types';
import { scopeLabel, scopeOfSegment, scopesOf, type ResultsScope } from '../../domain/resultScopes';
import { printJudgeSheets, printResults, printSkatingOrder } from '../../pdf/actions';
import type { ResultsStyle } from '../../pdf/documents';
import { useEventResult } from '../scoring/useEventResult';
import { JudgeSheetsPreview, ResultsPreview, SkatingOrderPreview, splitEvenly } from './PdfPreviews';

type Section = 'order' | 'sheets' | 'results';
type Layout = 'combined' | 'perPart';

export const RESULTS: { value: ResultsStyle; label: string; description: string }[] = [
  {
    value: 'standard',
    label: 'Results',
    description: 'Placings with points and the rule that settled any tie.',
  },
  {
    value: 'withMarks',
    label: 'Results with marks',
    description: 'Every judge’s marks, the table of victories and full tie explanations.',
  },
  {
    value: 'guest',
    label: 'Results for guest judges',
    description: 'Placings only: no scores, rules or rule key.',
  },
];

/** The tick-list of an event's parts. `off` holds the ones unticked, so new parts start ticked. */
function PartsPicker({
  segments,
  off,
  onChange,
  noun,
}: {
  segments: Segment[];
  off: ReadonlySet<string>;
  onChange: (off: ReadonlySet<string>) => void;
  noun: string;
}) {
  const toggle = (id: string, on: boolean) => {
    const next = new Set(off);
    if (on) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  return (
    <Stack gap={6}>
      <Group justify="space-between">
        <Text size="sm" fw={600}>
          Which {noun}s
        </Text>
        <Group gap="sm">
          <Anchor component="button" type="button" size="xs" onClick={() => onChange(new Set())}>
            All
          </Anchor>
          <Anchor
            component="button"
            type="button"
            size="xs"
            onClick={() => onChange(new Set(segments.map((s) => s.id)))}
          >
            None
          </Anchor>
        </Group>
      </Group>
      {segments.map((s) => (
        <Checkbox
          key={s.id}
          label={s.name}
          checked={!off.has(s.id)}
          onChange={(e) => toggle(s.id, e.currentTarget.checked)}
        />
      ))}
    </Stack>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Launchpad for an event's PDFs: skating order, judge sheets and results. It stays open until dismissed,
 * so several PDFs can be opened one after another.
 */
export function EventPdfModal({
  event,
  opened,
  onClose,
}: {
  event: CompEvent;
  opened: boolean;
  onClose: () => void;
}) {
  const competition = useCompetition(event.competitionId);
  const { segments, entries, result, segmentResults } = useEventResult(event);
  const [section, setSection] = useState<Section>('order');
  const [orderOff, setOrderOff] = useState<ReadonlySet<string>>(new Set());
  const [sheetsOff, setSheetsOff] = useState<ReadonlySet<string>>(new Set());
  const [layout, setLayout] = useState<Layout>('combined');
  const [style, setStyle] = useState<ResultsStyle>('standard');
  const [scope, setScope] = useState<ResultsScope>('final');
  const [busy, setBusy] = useState(false);

  const noun = segmentNoun(event);
  const entryCount = entries.length;
  const judgeCount = event.judgeIds.length;
  const starts = competition
    ? firstSkaters(segments, entryCount, effectiveRotate(event, competition))
    : new Map<string, number>();

  // Results from one kind of part alone are available as soon as some of those parts are fully marked.
  const scopes = scopesOf(segments).map((s) => {
    if (s === 'final')
      return {
        scope: s,
        ready: result.complete,
        marked: segments.map((x) => x.name),
        waiting: [] as string[],
      };
    const ofKind = segments.flatMap((x, i) =>
      scopeOfSegment(x.id) === s ? [{ name: x.name, done: segmentResults[i]?.complete }] : [],
    );
    return {
      scope: s,
      ready: ofKind.some((p) => p.done),
      marked: ofKind.filter((p) => p.done).map((p) => p.name),
      waiting: ofKind.filter((p) => !p.done).map((p) => p.name),
    };
  });
  const chosen = scopes.find((s) => s.scope === scope) ?? scopes[0]!;

  const orderParts = segments.filter((s) => !orderOff.has(s.id));
  const sheetParts = segments.filter((s) => !sheetsOff.has(s.id));

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

  const sheetsPerOfficial =
    layout === 'combined'
      ? splitEvenly(sheetParts, 4).length
      : sheetParts.length * (Math.ceil(entryCount / 24) || 1);
  const officials = (judgeCount || 3) + 1;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      centered
      title={
        <Group gap="xs">
          <IconFileTypePdf size={20} />
          <Text fw={700}>PDFs for {eventTitle(event)}</Text>
        </Group>
      }
    >
      <Stack>
        <SegmentedControl
          fullWidth
          value={section}
          onChange={(v) => setSection(v as Section)}
          data={[
            { value: 'order', label: 'Skating order' },
            { value: 'sheets', label: 'Judge sheets' },
            { value: 'results', label: 'Results' },
          ]}
        />

        {section === 'order' && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Stack>
              <Text size="sm">
                One page for each {noun} listing the skaters in the order they skate it, to display at the
                rink.
              </Text>
              {segments.length > 0 && (
                <PartsPicker segments={segments} off={orderOff} onChange={setOrderOff} noun={noun} />
              )}
              {starts.size > 0 && (
                <Text size="xs" c="dimmed">
                  This event rotates its start order, so each compulsory {noun} starts with its own first
                  skater.
                </Text>
              )}
            </Stack>
            <Stack>
              <SkatingOrderPreview
                entries={entryCount}
                parts={orderParts.map((s) => ({
                  name: s.name,
                  firstNumber: (starts.get(s.id) ?? 0) + 1,
                  rotates: starts.has(s.id),
                }))}
              />
              <Text size="xs" c="dimmed" ta="center">
                {orderParts.length === 0
                  ? 'Tick at least one part.'
                  : `${plural(orderParts.length, 'page')} · ${plural(entryCount, 'skater')} each`}
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
                    label={`A sheet per ${noun}`}
                    description="Separate sheets to hand out one part at a time. No totals."
                  />
                </Stack>
              </Radio.Group>
              {segments.length > 0 && (
                <PartsPicker segments={segments} off={sheetsOff} onChange={setSheetsOff} noun={noun} />
              )}
              {layout === 'combined' && sheetParts.length > 0 && sheetParts.length < segments.length && (
                <Text size="xs" c="dimmed">
                  Total points and Place are left off when only some parts are printed.
                </Text>
              )}
            </Stack>
            <Stack>
              <JudgeSheetsPreview
                parts={sheetParts.map((s) => s.name)}
                layout={layout}
                entries={entryCount}
                totals={sheetParts.length === segments.length}
              />
              <Text size="xs" c="dimmed" ta="center">
                {sheetParts.length === 0
                  ? 'Tick at least one part.'
                  : `${plural(sheetsPerOfficial * officials, 'sheet')} · ${sheetsPerOfficial} each for ${plural(
                      judgeCount || 3,
                      'judge',
                    )} and the referee`}
              </Text>
            </Stack>
          </SimpleGrid>
        )}

        {section === 'results' && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Stack>
              {scopes.length > 1 && (
                <Radio.Group
                  value={chosen.scope}
                  onChange={(v) => setScope(v as ResultsScope)}
                  label="Results for"
                >
                  <Stack gap={6} mt={6}>
                    {scopes.map((s) => (
                      <Radio
                        key={s.scope}
                        value={s.scope}
                        label={scopeLabel[s.scope]}
                        disabled={s.scope !== 'final' && !s.ready}
                        description={
                          s.scope === 'final'
                            ? 'Every part, once all the marks are in.'
                            : s.ready
                              ? `Based on ${s.marked.join(', ')}${s.waiting.length ? `; ${s.waiting.join(', ')} not fully marked yet` : ''}.`
                              : 'Not fully marked yet.'
                        }
                      />
                    ))}
                  </Stack>
                </Radio.Group>
              )}
              <Radio.Group value={style} onChange={(v) => setStyle(v as ResultsStyle)} label="Style">
                <Stack gap={6} mt={6}>
                  {RESULTS.map((r) => (
                    <Radio key={r.value} value={r.value} label={r.label} description={r.description} />
                  ))}
                </Stack>
              </Radio.Group>
              {chosen.scope === 'final' && !result.complete && (
                <Alert color="yellow" variant="light">
                  {judgeCount === 0
                    ? 'No judges assigned yet.'
                    : `${result.missingMarks} of ${result.totalMarks} marks still to enter.`}{' '}
                  The final results can be printed when every mark is in
                  {scopes.length > 1 ? ', or choose results for just the parts that are marked' : ''}.
                </Alert>
              )}
            </Stack>
            <ResultsPreview style={style} entries={entryCount} judges={judgeCount} />
          </SimpleGrid>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          {section === 'order' && (
            <Button
              leftSection={<IconFileTypePdf size={16} />}
              loading={busy}
              disabled={orderParts.length === 0}
              onClick={() =>
                run(() =>
                  printSkatingOrder(
                    { eventId: event.id },
                    eventTitle(event),
                    new Set(orderParts.map((s) => s.id)),
                  ),
                )
              }
            >
              Create skating order
            </Button>
          )}
          {section === 'sheets' && (
            <Button
              leftSection={<IconFileTypePdf size={16} />}
              loading={busy}
              disabled={sheetParts.length === 0}
              onClick={() =>
                run(() =>
                  printJudgeSheets({ eventId: event.id }, eventTitle(event), {
                    layout,
                    ...(sheetParts.length < segments.length && {
                      segmentIds: new Set(sheetParts.map((s) => s.id)),
                    }),
                  }),
                )
              }
            >
              Create judge sheets
            </Button>
          )}
          {section === 'results' && (
            <Button
              leftSection={<IconFileTypePdf size={16} />}
              loading={busy}
              disabled={!chosen.ready}
              onClick={() =>
                run(() => printResults({ eventId: event.id }, eventTitle(event), style, chosen.scope))
              }
            >
              Create results
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
