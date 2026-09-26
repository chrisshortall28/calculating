import { Button, Group, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import type { Competition } from '../../domain/types';

export type CompetitionDetails = Pick<Competition, 'name' | 'date' | 'venue'>;

export const emptyCompetitionDetails = (): CompetitionDetails => ({
  name: '',
  date: new Date().toISOString().slice(0, 10),
  venue: '',
});

/** Name / date / venue form, used when creating a competition and when editing its details. */
export function CompetitionDetailsForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: CompetitionDetails;
  submitLabel: string;
  onSubmit: (values: CompetitionDetails) => Promise<unknown>;
}) {
  const form = useForm<CompetitionDetails>({
    initialValues: initial,
    validate: { name: (v) => (v.trim() ? null : 'Name is required') },
  });

  return (
    <form
      onSubmit={form.onSubmit(async (v) => {
        await onSubmit({ name: v.name.trim(), date: v.date, venue: v.venue.trim() });
        form.resetDirty();
      })}
    >
      <Stack>
        <TextInput label="Name" data-autofocus required {...form.getInputProps('name')} />
        <TextInput label="Date" type="date" {...form.getInputProps('date')} />
        <TextInput label="Venue" {...form.getInputProps('venue')} />
        <Group justify="flex-end">
          <Button type="submit">{submitLabel}</Button>
        </Group>
      </Stack>
    </form>
  );
}
