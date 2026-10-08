import { Anchor, Container, Group, Stack, Tabs, Text, type MantineSize } from '@mantine/core';
import type { ReactNode } from 'react';
import { clubColors, clubVars, type ClubColors } from './clubColors';
import { Link } from 'react-router';
import classes from './PageHero.module.css';

export interface Crumb {
  label: string;
  to?: string;
}

/** Bold title band used at the top of pages; takes a competition's club colours (default navy and gold). */
export function PageHero({
  crumbs,
  title,
  titleAddon,
  titleStart,
  titleEnd,
  meta,
  badges,
  actions,
  children,
  size = 'lg',
  colors = clubColors(),
}: {
  crumbs: Crumb[];
  title: ReactNode;
  titleAddon?: ReactNode;
  /** Beside the title, before and after it. On narrow screens they drop beneath the title, which then gets the full width. */
  titleStart?: ReactNode;
  titleEnd?: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  /** Rendered along the bottom edge of the band (e.g. HeroTabs). */
  children?: ReactNode;
  /** Match the page Container size so the band content lines up with the page. */
  size?: MantineSize;
  colors?: ClubColors;
}) {
  const hasTitleNav = !!(titleStart || titleEnd);

  return (
    <div className={classes.hero} style={clubVars(colors)}>
      <Container size={size} className={classes.inner}>
        {crumbs.length > 0 && (
          <Group gap={6} className={classes.crumbs} wrap="nowrap">
            {crumbs.map((c, i) => (
              <Group
                key={i}
                gap={6}
                wrap="nowrap"
                className={i > 0 && i === crumbs.length - 1 && !c.to ? classes.crumbCurrentItem : undefined}
              >
                {i > 0 && <span className={classes.sep}>/</span>}
                {c.to ? (
                  <Anchor component={Link} to={c.to} className={classes.crumbLink}>
                    {c.label}
                  </Anchor>
                ) : (
                  <Text span className={classes.crumbCurrent} truncate>
                    {c.label}
                  </Text>
                )}
              </Group>
            ))}
          </Group>
        )}
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <Stack gap={6} style={{ minWidth: 0, flexGrow: hasTitleNav ? 1 : undefined }}>
            <div className={`${classes.titleRow} ${hasTitleNav ? classes.titleRowNav : ''}`}>
              {titleStart}
              <h1 className={classes.title}>{title}</h1>
              {titleEnd}
              {titleAddon}
            </div>
            {(meta || badges) && (
              <Group gap="md" className={classes.meta}>
                {badges}
                {meta}
              </Group>
            )}
          </Stack>
          {actions && <Group gap="sm">{actions}</Group>}
        </Group>
      </Container>
      {children && <Container size={size}>{children}</Container>}
    </div>
  );
}

/** A meta item (icon + text) for the hero's details line. */
export function HeroMeta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Group gap={6} wrap="nowrap" className={classes.metaItem}>
      {icon}
      <span>{children}</span>
    </Group>
  );
}

export interface HeroTab {
  value: string;
  label: string;
  icon: ReactNode;
}

/** Tabs that sit along the bottom edge of a PageHero. */
export function HeroTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: HeroTab[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Tabs
      value={value}
      onChange={(v) => v && onChange(v)}
      classNames={{ list: classes.tabsList, tab: classes.tab }}
    >
      <Tabs.List>
        {tabs.map((t) => (
          <Tabs.Tab key={t.value} value={t.value} leftSection={t.icon}>
            {t.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
