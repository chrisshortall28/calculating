import { createTheme, type MantineColorsTuple } from '@mantine/core';

/** Cobalt — the primary action colour; a lighter, livelier relative of the navy. */
const podium: MantineColorsTuple = [
  '#edf2fb',
  '#d9e3f4',
  '#b0c5e9',
  '#84a5de',
  '#608ad4',
  '#4979cf',
  '#3c70cd',
  '#2e5fb5',
  '#2654a2',
  '#1b478f',
];

/** Deep navy — header, hero bands and headings. */
const navy: MantineColorsTuple = [
  '#eef2f9',
  '#dae1ee',
  '#b1c0dc',
  '#869dcb',
  '#627fbc',
  '#4c6cb4',
  '#4062b1',
  '#31529c',
  '#28488c',
  '#0b1d3a',
];

/** Medal gold — accents and highlights. */
const medal: MantineColorsTuple = [
  '#fff8e0',
  '#ffefca',
  '#ffdd99',
  '#ffca62',
  '#ffba36',
  '#ffb018',
  '#ffab02',
  '#e39500',
  '#ca8300',
  '#b07000',
];

export const theme = createTheme({
  colors: { podium, navy, medal },
  primaryColor: 'podium',
  primaryShade: { light: 7, dark: 6 },
  defaultRadius: 'md',
  fontFamily: '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif',
    fontWeight: '700',
  },
  other: {
    displayFont: '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif',
  },
  components: {
    Button: { defaultProps: { fw: 600 } },
    Badge: { defaultProps: { radius: 'sm' } },
    Card: { defaultProps: { radius: 'lg' } },
  },
});

/** Badge colours for each entry type. */
export const entryTypeColor = { solo: 'podium', duo: 'grape', team: 'orange' } as const;

/** Colours for event status (stripes, badges, progress). */
export const statusColor = { setup: 'gray', scoring: 'podium', final: 'teal' } as const;
