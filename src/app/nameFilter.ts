import type { ComboboxItem, OptionsFilter } from '@mantine/core';

/**
 * For the skater and judge name boxes: an option matches when it starts with what has been typed (ignoring
 * case and surrounding spaces), which is how people begin typing a name and keeps the list short.
 */
export const startsWithFilter: OptionsFilter = ({ options, search }) => {
  const q = search.trim().toLowerCase();
  return (options as ComboboxItem[]).filter((o) => o.label.toLowerCase().startsWith(q));
};
