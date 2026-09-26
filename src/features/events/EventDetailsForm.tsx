import { Button, Group, Input, MultiSelect, SegmentedControl, Stack, Switch, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDances } from '../../app/data';
import { MAX_COMPULSORY_DANCES, type CompEvent, type EntryType } from '../../domain/types';

export type EventDetails = Pick<CompEvent, 'name' | 'entryType' | 'compulsoryDanceIds' | 'hasFreeDance'>;

/** How many compulsory dances an event of each entry type usually has, for the field's hint. */
const TYPICAL_DANCES: Record<EntryType, string> = {
  solo: 'Usually 1 or 2 for solo events. ',
  duo: '',
  team: 'Usually 3 or 4 for team events. ',
};

export function EventDetailsForm({
  competitionId,
  initial,
  submitLabel,
  onSubmit,
}: {
  competitionId: string;
  initial?: EventDetails;
  submitLabel: string;
  onSubmit: (values: EventDetails) => unknown;
}) {
  const dances = useDances(competitionId);
  const form = useForm<EventDetails>({
    initialValues: initial ?? { name: '', entryType: 'solo', compulsoryDanceIds: [], hasFreeDance: false },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      compulsoryDanceIds: (v, values) =>
        v.length > MAX_COMPULSORY_DANCES
          ? `At most ${MAX_COMPULSORY_DANCES} compulsory dances`
          : v.length === 0 && !values.hasFreeDance
            ? 'Choose at least one compulsory dance or the free dance'
            : null,
    },
  });

  return (
    <form
      onSubmit={form.onSubmit(async (v) => {
        await onSubmit({ ...v, name: v.name.trim() });
      })}
    >
      <Stack>
        <TextInput
          label="Event name"
          placeholder="e.g. Novice Girls Solo Dance"
          data-autofocus
          required
          {...form.getInputProps('name')}
        />
        <Input.Wrapper label="Entry type">
          <SegmentedControl
            display="flex"
            w="fit-content"
            mt={4}
            data={[
              { value: 'solo', label: 'Solo' },
              { value: 'duo', label: 'Duo' },
              { value: 'team', label: 'Team' },
            ]}
            value={form.values.entryType}
            onChange={(v) => form.setFieldValue('entryType', v as EntryType)}
          />
        </Input.Wrapper>
        <MultiSelect
          label="Compulsory dances"
          description={`${TYPICAL_DANCES[form.values.entryType]}Up to ${MAX_COMPULSORY_DANCES}, in the order they are skated`}
          placeholder={
            form.values.compulsoryDanceIds.length < MAX_COMPULSORY_DANCES ? 'Choose dances' : undefined
          }
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
        <Group justify="flex-end">
          <Button type="submit">{submitLabel}</Button>
        </Group>
      </Stack>
    </form>
  );
}
