import { Button, Group, MultiSelect, SegmentedControl, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDances } from '../../app/data';
import { MAX_COMPULSORY_DANCES, type CompEvent, type EntryType } from '../../domain/types';

export type EventDetails = Pick<CompEvent, 'name' | 'entryType' | 'compulsoryDanceIds' | 'hasFreeDance'>;

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
        <div>
          <Text size="sm" fw={500} mb={4}>
            Entry type
          </Text>
          <SegmentedControl
            data={[
              { value: 'solo', label: 'Solo' },
              { value: 'duo', label: 'Duo' },
              { value: 'team', label: 'Team' },
            ]}
            value={form.values.entryType}
            onChange={(v) => form.setFieldValue('entryType', v as EntryType)}
          />
        </div>
        <MultiSelect
          label="Compulsory dances"
          description={`Up to ${MAX_COMPULSORY_DANCES}, in the order they are skated`}
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
        <Switch
          label="Includes a Free Dance (A and B marks)"
          {...form.getInputProps('hasFreeDance', { type: 'checkbox' })}
        />
        <Group justify="flex-end">
          <Button type="submit">{submitLabel}</Button>
        </Group>
      </Stack>
    </form>
  );
}
