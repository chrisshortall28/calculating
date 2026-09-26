import { Anchor, Button, ColorInput, Group, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { clubColors, clubVars, DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../app/clubColors';
import type { Competition } from '../../domain/types';
import classes from './CompetitionDetailsForm.module.css';

export type CompetitionDetails = Pick<
  Competition,
  'name' | 'date' | 'venue' | 'primaryColor' | 'secondaryColor' | 'welcome'
>;

export const emptyCompetitionDetails = (): CompetitionDetails => ({
  name: '',
  date: new Date().toISOString().slice(0, 10),
  venue: '',
});

/** The editable details of an existing competition. */
export const detailsOf = (c: Competition): CompetitionDetails => ({
  name: c.name,
  date: c.date,
  venue: c.venue,
  primaryColor: c.primaryColor,
  secondaryColor: c.secondaryColor,
  welcome: c.welcome,
});

const HEX = /^#[0-9a-f]{6}$/i;

/** Common club colours to pick from quickly. */
const SWATCHES = [
  DEFAULT_PRIMARY,
  DEFAULT_SECONDARY,
  '#c8102e',
  '#7a0019',
  '#e35205',
  '#ffd100',
  '#00843d',
  '#004225',
  '#00a3e0',
  '#003da5',
  '#582c83',
  '#d6006f',
  '#000000',
  '#ffffff',
];

interface FormValues {
  name: string;
  date: string;
  venue: string;
  primaryColor: string;
  secondaryColor: string;
  welcome: string;
}

/** Name / date / venue / club colours / welcome form, for creating a competition and editing its details. */
export function CompetitionDetailsForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: CompetitionDetails;
  submitLabel: string;
  onSubmit: (values: CompetitionDetails) => Promise<unknown>;
}) {
  const form = useForm<FormValues>({
    initialValues: {
      name: initial.name,
      date: initial.date,
      venue: initial.venue,
      primaryColor: clubColors(initial).primary,
      secondaryColor: clubColors(initial).secondary,
      welcome: initial.welcome ?? '',
    },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      primaryColor: (v) => (HEX.test(v) ? null : 'Use a colour like #0b1d3a'),
      secondaryColor: (v) => (HEX.test(v) ? null : 'Use a colour like #ffb018'),
    },
  });

  // Colours equal to the defaults are stored as unset, so they keep following the app's defaults.
  const stored = (v: string, fallback: string) =>
    v.toLowerCase() === fallback.toLowerCase() ? undefined : v.toLowerCase();

  const { values } = form;
  const previewColors = {
    primary: HEX.test(values.primaryColor) ? values.primaryColor : DEFAULT_PRIMARY,
    secondary: HEX.test(values.secondaryColor) ? values.secondaryColor : DEFAULT_SECONDARY,
  };
  const isDefault =
    previewColors.primary.toLowerCase() === DEFAULT_PRIMARY &&
    previewColors.secondary.toLowerCase() === DEFAULT_SECONDARY;

  return (
    <form
      onSubmit={form.onSubmit(async (v) => {
        await onSubmit({
          name: v.name.trim(),
          date: v.date,
          venue: v.venue.trim(),
          primaryColor: stored(v.primaryColor, DEFAULT_PRIMARY),
          secondaryColor: stored(v.secondaryColor, DEFAULT_SECONDARY),
          welcome: v.welcome.trim() || undefined,
        });
        form.resetDirty();
      })}
    >
      <Stack>
        <TextInput label="Name" data-autofocus required {...form.getInputProps('name')} />
        <TextInput label="Date" type="date" {...form.getInputProps('date')} />
        <TextInput label="Venue" {...form.getInputProps('venue')} />

        <div>
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={500}>
              Club colours
            </Text>
            {!isDefault && (
              <Anchor
                component="button"
                type="button"
                size="xs"
                onClick={() =>
                  form.setValues({ primaryColor: DEFAULT_PRIMARY, secondaryColor: DEFAULT_SECONDARY })
                }
              >
                Reset to default colours
              </Anchor>
            )}
          </Group>
          <Group grow align="flex-start">
            <ColorInput
              label="Primary"
              description="Title band and card"
              format="hex"
              swatches={SWATCHES}
              swatchesPerRow={7}
              {...form.getInputProps('primaryColor')}
            />
            <ColorInput
              label="Secondary"
              description="Accents and highlights"
              format="hex"
              swatches={SWATCHES}
              swatchesPerRow={7}
              {...form.getInputProps('secondaryColor')}
            />
          </Group>
          <div className={classes.preview} style={clubVars(previewColors)} aria-hidden="true">
            <span className={classes.previewTile}>26</span>
            <span className={classes.previewName}>{values.name.trim() || 'Competition name'}</span>
          </div>
        </div>

        <Textarea
          label="Programme welcome"
          description="Opens the programme; leave blank lines between paragraphs. Leave empty for a standard welcome."
          autosize
          minRows={3}
          maxRows={10}
          {...form.getInputProps('welcome')}
        />

        <Group justify="flex-end">
          <Button type="submit">{submitLabel}</Button>
        </Group>
      </Stack>
    </form>
  );
}
