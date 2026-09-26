import { isLightColor, lighten } from '@mantine/core';
import type { CSSProperties } from 'react';

/** Default club colours: the app's navy and medal gold. */
export const DEFAULT_PRIMARY = '#0b1d3a';
export const DEFAULT_SECONDARY = '#ffb018';

/** Readable text/icon colour on top of a background colour. */
const onColor = (background: string) => (isLightColor(background) ? DEFAULT_PRIMARY : '#ffffff');

export interface ClubColors {
  primary: string;
  secondary: string;
}

export function clubColors(c?: { primaryColor?: string; secondaryColor?: string }): ClubColors {
  return {
    primary: c?.primaryColor || DEFAULT_PRIMARY,
    secondary: c?.secondaryColor || DEFAULT_SECONDARY,
  };
}

/**
 * CSS variables for club-coloured surfaces (competition card and title band):
 *  --club-primary / --club-primary-soft  background and its gradient partner
 *  --club-on-primary                     text/icons on the primary colour
 *  --club-secondary / --club-on-secondary  accent (stripes, tiles, tab indicator) and its text
 */
export function clubVars({ primary, secondary }: ClubColors): CSSProperties {
  return {
    ['--club-primary' as string]: primary,
    ['--club-primary-soft' as string]: lighten(primary, 0.1),
    ['--club-on-primary' as string]: onColor(primary),
    ['--club-secondary' as string]: secondary,
    ['--club-on-secondary' as string]: onColor(secondary),
  };
}
