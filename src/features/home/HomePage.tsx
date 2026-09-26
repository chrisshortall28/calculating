import { Anchor, Button, Card, Container, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconArrowRight,
  IconBolt,
  IconBrandOpenSource,
  IconCalculator,
  IconDevices,
  IconFileTypePdf,
  IconHelpCircle,
  IconListDetails,
  IconPencil,
  IconShieldCheck,
  IconTrophy,
  IconWifiOff,
} from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { SectionHeader } from '../../app/SectionHeader';
import { db } from '../../db/db';
import { CompetitionCard, NewCompetitionButton, useCompetitionStats } from '../competitions/CompetitionCard';
import { HeroArt } from './HeroArt';
import classes from './HomePage.module.css';

const STEPS = [
  {
    icon: <IconListDetails size={22} />,
    title: 'Set up',
    text: 'Add events, skaters, judges and dances — type them in or paste a whole list at once.',
  },
  {
    icon: <IconPencil size={22} />,
    title: 'Enter marks',
    text: 'Key in each judge’s marks in a keyboard-driven grid: type 57 for 5.7 and move straight on.',
  },
  {
    icon: <IconCalculator size={22} />,
    title: 'Calculate',
    text: 'Placings are worked out by the CIPA system of majority victories, showing how every tie was resolved.',
  },
  {
    icon: <IconFileTypePdf size={22} />,
    title: 'Publish',
    text: 'Print judges’ sheets beforehand and results afterwards, for one event or the whole day.',
  },
];

const ADVANTAGES = [
  {
    icon: <IconBolt size={20} />,
    title: 'Fast to use',
    text: 'Rapid entry of events, skaters, officials and marks, designed around the keyboard so the results keep pace with the skating.',
  },
  {
    icon: <IconShieldCheck size={20} />,
    title: 'Scoring you can trust',
    text: 'Results show the full breakdown of how the CIPA scoring system was applied, so every placing can be seen and checked.',
  },
  {
    icon: <IconFileTypePdf size={20} />,
    title: 'Paperwork in seconds',
    text: 'Export judges’ sheets and results PDFs in moments, styled in the competition’s club colours.',
  },
  {
    icon: <IconDevices size={20} />,
    title: 'Runs on anything',
    text: 'Windows and Mac laptops, phones and tablets — all you need is a web browser.',
  },
  {
    icon: <IconWifiOff size={20} />,
    title: 'Works offline',
    text: 'Use it in the browser or install it as an app. Once loaded, no internet is needed at the rink, and your data stays on your device. New versions arrive whenever you next go online.',
  },
  {
    icon: <IconBrandOpenSource size={20} />,
    title: 'Open source',
    text: (
      <>
        Built in the open on open-source libraries, so it is easy to maintain and improve.{' '}
        <Anchor
          href="https://github.com/chrisshortall28/calculating"
          target="_blank"
          rel="noreferrer"
          inherit
        >
          View the code
        </Anchor>
        .
      </>
    ),
  },
] satisfies { icon: ReactNode; title: string; text: ReactNode }[];

export function HomePage() {
  const latest = useLiveQuery(() => db.competitions.orderBy('updatedAt').last());
  const count = useLiveQuery(() => db.competitions.count());
  const stats = useCompetitionStats();

  return (
    <>
      <section className={classes.hero}>
        <Container size="lg" className={classes.heroInner}>
          <div className={classes.heroText}>
            <Text className={classes.eyebrow}>Artistic roller skating scoring</Text>
            <h1 className={classes.heroTitle}>
              From first mark <span className={classes.accent}>to podium</span>
            </h1>
            <Text className={classes.intro}>
              Podium is the Calculator’s companion for roller skating competitions. Set up the events, key in
              the judges’ marks and get placings, judges’ sheets and results in moments — on any device, with
              or without an internet connection.
            </Text>
            <Button
              component={Link}
              to="/guide"
              variant="white"
              color="navy.9"
              mt="lg"
              leftSection={<IconHelpCircle size={18} />}
            >
              How Podium works offline
            </Button>
          </div>
          <HeroArt className={classes.heroArt} />
        </Container>
      </section>

      <Container size="lg">
        <Stack gap={48}>
          <Stack gap="md">
            <SectionHeader title={latest ? 'Latest competition' : 'Get started'} />
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
              {latest ? (
                <CompetitionCard competition={latest} stats={stats?.get(latest.id)} />
              ) : (
                count === 0 && (
                  <Card withBorder className={classes.emptyCard}>
                    <IconTrophy size={40} color="var(--mantine-color-medal-5)" />
                    <Text fw={700} mt="xs">
                      No competitions yet
                    </Text>
                    <Text c="dimmed" size="sm">
                      Your competitions will appear here once you create or import one.
                    </Text>
                  </Card>
                )
              )}
              <Card withBorder className={classes.startCard}>
                <Stack gap="sm" h="100%" justify="space-between">
                  <div>
                    <Text className="display" fz={24}>
                      Calculating an event?
                    </Text>
                    <Text c="dimmed" size="sm" mt={4}>
                      Create a competition, then add its events, skaters and judges. You can import a
                      competition file from the competitions page.
                    </Text>
                  </div>
                  <Stack gap="xs">
                    <NewCompetitionButton fullWidth />
                    <Button
                      component={Link}
                      to="/competitions"
                      variant="default"
                      fullWidth
                      rightSection={<IconArrowRight size={16} />}
                    >
                      All competitions{count ? ` (${count})` : ''}
                    </Button>
                  </Stack>
                </Stack>
              </Card>
            </SimpleGrid>
          </Stack>

          <Stack gap="md">
            <SectionHeader title="What Podium does" />
            <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="lg">
              {STEPS.map((s, i) => (
                <Card key={s.title} withBorder className={classes.step}>
                  <span className={classes.stepNumber}>{i + 1}</span>
                  <ThemeIcon size={44} radius="md" color="navy.9" c="medal.4">
                    {s.icon}
                  </ThemeIcon>
                  <Text className="display" fz={24} mt="sm">
                    {s.title}
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    {s.text}
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>

          <Stack gap="md" pb="xl">
            <SectionHeader title="Why Podium" />
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
              {ADVANTAGES.map((a) => (
                <div key={a.title} className={classes.advantage}>
                  <ThemeIcon size={38} radius="xl" variant="light" color="podium">
                    {a.icon}
                  </ThemeIcon>
                  <div>
                    <Text fw={700}>{a.title}</Text>
                    <Text size="sm" c="dimmed" mt={2}>
                      {a.text}
                    </Text>
                  </div>
                </div>
              ))}
            </SimpleGrid>
          </Stack>
        </Stack>
      </Container>
    </>
  );
}
