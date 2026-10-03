import {
  ActionIcon,
  Button,
  Group,
  Input,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useRef, type ComponentProps } from 'react';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useDances } from '../../app/data';
import { FIGURES } from '../../domain/figures';
import { cfKey, danceEventDefaults, defaultFactors, NO_FACTORS } from '../../domain/segments';
import {
  MAX_COMPULSORY_DANCES,
  MAX_FIGURES,
  type CompEvent,
  type EntryType,
  type EventDiscipline,
  type FigureSide,
} from '../../domain/types';

export type EventDetails = Pick<
  CompEvent,
  | 'name'
  | 'entryType'
  | 'discipline'
  | 'compulsoryDanceIds'
  | 'hasFreeDance'
  | 'figures'
  | 'hasShort'
  | 'hasLong'
  | 'factors'
>;

/** Factors as the Calculator types them (1.5), rather than as stored (150 hundredths). */
type Factor = number | string; // NumberInput gives a string while a number is part-typed ("1.")
type FormValues = Omit<EventDetails, 'discipline' | 'factors'> & {
  /** Blank until the Calculator chooses, when creating an event. */
  discipline: EventDiscipline | '';
  factors: { figures: Factor; short: Factor; long: Factor };
};

/** How many compulsory dances an event of each entry type usually has, for the field's hint. */
const TYPICAL_DANCES: Partial<Record<EntryType, string>> = {
  solo: 'Usually 1 or 2 for solo events. ',
  duo: 'Usually 1 or 2 for duo events. ',
  couples: 'Usually 1 or 2 for couples events. ',
  team: 'Usually 3 or 4 for team events. ',
};

const ENTRY_TYPES: Record<EventDiscipline, { value: EntryType; label: string }[]> = {
  dance: [
    { value: 'solo', label: 'Solo' },
    { value: 'duo', label: 'Duo' },
    { value: 'couples', label: 'Couples' },
    { value: 'team', label: 'Team' },
  ],
  figures: [
    { value: 'single', label: 'Single' },
    { value: 'pairs', label: 'Pairs' },
  ],
};

const FIGURE_OPTIONS = FIGURES.map((f) => ({ value: f.id, label: `${f.id}. ${f.name} ${f.direction}` }));

const toDecimal = (f: CompEvent['factors']) => ({
  figures: f.figures / 100,
  short: f.short / 100,
  long: f.long / 100,
});
const toHundredths = (f: FormValues['factors']) => ({
  figures: Math.round(Number(f.figures) * 100),
  short: Math.round(Number(f.short) * 100),
  long: Math.round(Number(f.long) * 100),
});

const positive = (f: Factor) => (Number(f) >= 0.01 ? null : 'At least 0.01');

const emptyEvent: FormValues = {
  name: '',
  entryType: 'solo',
  compulsoryDanceIds: [],
  hasFreeDance: false,
  ...danceEventDefaults(),
  discipline: '',
  factors: toDecimal(NO_FACTORS),
};

export function EventDetailsForm({
  competitionId,
  initial,
  submitLabel,
  onSubmit,
  keepAdding,
}: {
  competitionId: string;
  initial?: EventDetails;
  submitLabel: string;
  onSubmit: (values: EventDetails) => unknown;
  /**
   * Shows a switch beside the submit button. While it is on, the form stays open after a submit with
   * the same settings and a blank name, ready for the next event.
   */
  keepAdding?: { checked: boolean; onChange: (checked: boolean) => void };
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const dances = useDances(competitionId);
  const form = useForm<FormValues>({
    initialValues: initial ? { ...initial, factors: toDecimal(initial.factors) } : emptyEvent,
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      discipline: (v) => (v ? null : 'Choose the event type'),
      compulsoryDanceIds: (v, values) =>
        values.discipline !== 'dance'
          ? null
          : v.length > MAX_COMPULSORY_DANCES
            ? `At most ${MAX_COMPULSORY_DANCES} compulsory dances`
            : v.length === 0 && !values.hasFreeDance
              ? 'Choose at least one compulsory dance or the free dance'
              : null,
      figures: (v, values) => {
        if (values.discipline !== 'figures') return null;
        if (v.some((f) => !f.figureId)) return 'Choose each figure, or remove the empty row';
        if (new Set(v.map(cfKey)).size < v.length) return 'The same figure is chosen twice on the same side';
        if (v.length === 0 && !values.hasShort && !values.hasLong)
          return 'Choose at least one figure or programme';
        return null;
      },
      factors: {
        figures: positive,
        short: positive,
        long: positive,
      },
    },
  });
  const v = form.values;

  /** Changes the figures or programmes, and puts the factors back to the defaults for the new mix. */
  const setParts = (next: Partial<Pick<FormValues, 'figures' | 'hasShort' | 'hasLong'>>) => {
    const parts = { figures: v.figures, hasShort: v.hasShort, hasLong: v.hasLong, ...next };
    form.setValues({
      ...parts,
      factors: toDecimal(defaultFactors(parts.figures.length, parts.hasShort, parts.hasLong)),
    });
  };
  const setFigure = (i: number, f: Partial<FormValues['figures'][number]>) =>
    form.setFieldValue(
      'figures',
      v.figures.map((x, xi) => (xi === i ? { ...x, ...f } : x)),
    );

  const partTypes = (v.figures.length > 0 ? 1 : 0) + (v.hasShort ? 1 : 0) + (v.hasLong ? 1 : 0);

  const submit = form.onSubmit(async (values) => {
    const base = { ...values, discipline: values.discipline as EventDiscipline, name: values.name.trim() };
    await onSubmit(
      values.discipline === 'figures'
        ? {
            ...base,
            compulsoryDanceIds: [],
            hasFreeDance: false,
            figures: values.figures.map(({ figureId, side }) => (side ? { figureId, side } : { figureId })),
            factors: toHundredths(values.factors),
          }
        : { ...base, figures: [], hasShort: false, hasLong: false, factors: { ...NO_FACTORS } },
    );
    if (keepAdding?.checked) {
      form.setFieldValue('name', '');
      form.clearErrors();
      nameRef.current?.focus();
    }
  });

  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput
          label="Event name"
          placeholder={
            v.discipline === 'figures' ? 'e.g. Novice Ladies Figures & Free' : 'e.g. Novice Ladies Solo Dance'
          }
          data-autofocus
          ref={nameRef}
          required
          {...form.getInputProps('name')}
        />
        <Input.Wrapper
          label="Event type"
          withAsterisk
          error={form.errors.discipline}
          inputWrapperOrder={['label', 'input', 'error']}
        >
          <SegmentedControl
            display="flex"
            w="fit-content"
            my={4}
            data={[
              { value: 'dance', label: 'Dance' },
              { value: 'figures', label: 'Figures & Free' },
            ]}
            value={v.discipline}
            onChange={(d) =>
              form.setValues({
                discipline: d as EventDiscipline,
                entryType: ENTRY_TYPES[d as EventDiscipline][0]!.value,
              })
            }
          />
        </Input.Wrapper>
        {v.discipline && (
          <Input.Wrapper
            label="Entry type"
            description={
              v.discipline === 'dance'
                ? 'Use ‘Team’ for team, super-team, quartet and show events'
                : undefined
            }
            inputWrapperOrder={['label', 'input', 'description', 'error']}
          >
            <SegmentedControl
              display="flex"
              w="fit-content"
              my={4}
              data={ENTRY_TYPES[v.discipline]}
              value={v.entryType}
              onChange={(t) => form.setFieldValue('entryType', t as EntryType)}
            />
          </Input.Wrapper>
        )}

        {v.discipline === 'dance' && (
          <>
            <MultiSelect
              label="Compulsory dances"
              description={`${TYPICAL_DANCES[v.entryType] ?? ''}Up to ${MAX_COMPULSORY_DANCES}, in the order they are skated`}
              placeholder={v.compulsoryDanceIds.length < MAX_COMPULSORY_DANCES ? 'Choose dances' : undefined}
              data={(dances ?? []).map((d) => ({ value: d.id, label: d.name }))}
              maxValues={MAX_COMPULSORY_DANCES}
              searchable
              selectFirstOptionOnChange
              clearable
              {...form.getInputProps('compulsoryDanceIds')}
            />
            {/* Labelled like the compulsory dances field above, so the two dance choices read as a pair. */}
            <Input.Wrapper
              label="Free dance"
              description="Marked by each judge with an A (technical) and B (artistic impression) mark"
            >
              <Switch
                mt={6}
                label="Includes a free dance"
                {...form.getInputProps('hasFreeDance', { type: 'checkbox' })}
              />
            </Input.Wrapper>
          </>
        )}
        {v.discipline === 'figures' && (
          <>
            <Input.Wrapper
              label="Compulsory figures"
              description={`Up to ${MAX_FIGURES}, in the order they are skated; each on the left or right, or unspecified`}
              error={form.errors.figures}
            >
              <Stack gap="xs" mt={6}>
                {v.figures.map((f, i) => (
                  <Group key={i} gap="xs" wrap="nowrap">
                    <Select
                      aria-label={`Figure ${i + 1}`}
                      placeholder="Choose a figure"
                      data={FIGURE_OPTIONS}
                      value={f.figureId || null}
                      onChange={(id) => setFigure(i, { figureId: id ?? '' })}
                      searchable
                      selectFirstOptionOnChange
                      style={{ flex: 1 }}
                    />
                    <SegmentedControl
                      aria-label={`Figure ${i + 1} side`}
                      data={[
                        { value: 'L', label: 'Left' },
                        { value: '-', label: '–' },
                        { value: 'R', label: 'Right' },
                      ]}
                      value={f.side ?? '-'}
                      onChange={(s) => setFigure(i, { side: s === '-' ? undefined : (s as FigureSide) })}
                    />
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Remove figure ${i + 1}`}
                      onClick={() => setParts({ figures: v.figures.filter((_, xi) => xi !== i) })}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Group>
                ))}
                {v.figures.length < MAX_FIGURES && (
                  <Button
                    variant="light"
                    size="xs"
                    w="fit-content"
                    leftSection={<IconPlus size={14} />}
                    onClick={() => setParts({ figures: [...v.figures, { figureId: '' }] })}
                  >
                    Add figure
                  </Button>
                )}
              </Stack>
            </Input.Wrapper>
            <Input.Wrapper
              label="Free skating"
              description="Each programme is marked by each judge with an A (technical) and B (artistic impression) mark"
            >
              <Group mt={6}>
                <Switch
                  label="Short programme"
                  checked={v.hasShort}
                  onChange={(e) => setParts({ hasShort: e.currentTarget.checked })}
                />
                <Switch
                  label="Free programme"
                  checked={v.hasLong}
                  onChange={(e) => setParts({ hasLong: e.currentTarget.checked })}
                />
              </Group>
            </Input.Wrapper>
            {partTypes > 1 && (
              <Input.Wrapper
                label="Factors"
                description="Each judge’s sum multiplies each part’s marks by its factor. Set to the defaults whenever the parts change."
                inputWrapperOrder={['label', 'input', 'description', 'error']}
              >
                <Group gap="xs" my={4} align="flex-start">
                  {v.figures.length > 0 && (
                    <FactorInput label="Figures" {...form.getInputProps('factors.figures')} />
                  )}
                  {v.hasShort && <FactorInput label="Short" {...form.getInputProps('factors.short')} />}
                  {v.hasLong && <FactorInput label="Free" {...form.getInputProps('factors.long')} />}
                </Group>
              </Input.Wrapper>
            )}
          </>
        )}
        <Group justify="flex-end">
          {keepAdding && (
            <Switch
              label="Keep adding events"
              checked={keepAdding.checked}
              onChange={(e) => keepAdding.onChange(e.currentTarget.checked)}
            />
          )}
          <Button type="submit">{submitLabel}</Button>
        </Group>
      </Stack>
    </form>
  );
}

function FactorInput({ label, ...props }: { label: string } & ComponentProps<typeof NumberInput>) {
  return (
    <NumberInput
      {...props}
      aria-label={`${label} factor`}
      leftSection={
        <Text size="xs" c="dimmed" pl={6}>
          {label} ×
        </Text>
      }
      leftSectionWidth={68}
      w={140}
      min={0.01}
      step={1}
      decimalScale={2}
    />
  );
}
