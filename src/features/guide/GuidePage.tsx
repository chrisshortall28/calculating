import {
  Alert,
  Anchor,
  Button,
  Card,
  Container,
  List,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconApps,
  IconChecklist,
  IconDatabase,
  IconDownload,
  IconFileExport,
  IconRefresh,
  IconWifiOff,
} from '@tabler/icons-react';
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { isInstalled, useInstallPrompt } from '../../app/installPrompt';
import { PageHero } from '../../app/PageHero';
import classes from './GuidePage.module.css';

const SECTIONS = [
  { id: 'offline', title: 'Working offline', icon: <IconWifiOff size={20} /> },
  { id: 'your-data', title: 'Where competitions are kept', icon: <IconDatabase size={20} /> },
  { id: 'export-import', title: 'Exporting and importing', icon: <IconFileExport size={20} /> },
  { id: 'install', title: 'Installing Podium', icon: <IconApps size={20} /> },
  { id: 'updates', title: 'Updates', icon: <IconRefresh size={20} /> },
  { id: 'checklist', title: 'Before competition day', icon: <IconChecklist size={20} /> },
];

export function GuidePage() {
  const { hash } = useLocation();

  // React Router doesn't scroll to #anchors itself.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo(0, 0);
  }, [hash]);

  return (
    <>
      <PageHero
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Guide' }]}
        title="Guide"
        size="md"
        meta={
          <Text size="sm">How Podium works offline, where your competitions live, and how to move them.</Text>
        }
      />
      <Container size="md">
        <Stack gap="xl" pb="xl">
          <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="sm">
            {SECTIONS.map((s) => (
              <Card
                key={s.id}
                withBorder
                component={Link}
                to={`#${s.id}`}
                replace
                className={classes.tocItem}
              >
                <ThemeIcon variant="light" color="podium" size={34} radius="md">
                  {s.icon}
                </ThemeIcon>
                <Text fw={600} size="sm">
                  {s.title}
                </Text>
              </Card>
            ))}
          </SimpleGrid>

          <Section id="offline">
            <Text>
              Podium runs entirely in your web browser — there is no server and no account. Once you have
              opened Podium while connected to the internet, your browser keeps a copy of the whole app, so it
              carries on working with <b>no internet connection at all</b>: set up events, enter marks,
              calculate results and print PDFs, all offline.
            </Text>
            <Text>
              The bar at the bottom of the screen shows whether you are <b>Online</b> or{' '}
              <b>Working offline</b>. Both are fine; you only need to be online to get Podium the first time
              and to pick up new versions.
            </Text>
            <Text c="dimmed" size="sm">
              Tip: after opening Podium for the first time, bookmark it or install it (see below) so it is
              easy to find again when you are offline.
            </Text>
          </Section>

          <Section id="your-data">
            <Text>
              Competitions are saved in your browser’s storage on this device, as you type — there is no Save
              button. They are never sent anywhere, which means:
            </Text>
            <List spacing="xs">
              <List.Item>
                <b>Only you can see them</b>, and only on this device, in this browser. Other people, your
                other devices, and even a different browser on the same computer (e.g. Chrome and Edge) each
                have their own separate, empty list.
              </List.Item>
              <List.Item>
                To <b>view a competition on another device, share it with someone, or back it up</b>, export
                it to a file and import that file elsewhere (see the next section).
              </List.Item>
              <List.Item>
                Nothing syncs automatically: changes made on one device don’t appear on another.
              </List.Item>
            </List>
            <Alert
              variant="light"
              color="orange"
              icon={<IconAlertTriangle size={18} />}
              title="Keep a backup"
            >
              Clearing your browser’s history or site data, or uninstalling the browser, can delete your
              competitions, and private or incognito windows forget everything when they close. Export
              competitions you care about regularly — for example at the end of each session — and keep the
              files somewhere safe.
            </Alert>
          </Section>

          <Section id="export-import">
            <Text fw={700}>Export a competition</Text>
            <List type="ordered" spacing="xs">
              <List.Item>
                Open the competition from the{' '}
                <Anchor component={Link} to="/competitions">
                  Competitions
                </Anchor>{' '}
                page.
              </List.Item>
              <List.Item>
                Click <b>Export file</b> at the top right. Your browser saves a <code>.pod</code> file named
                after the competition, the date and the time (usually in your Downloads folder).
              </List.Item>
            </List>
            <Text>
              The file holds everything: details, club colours, events, skaters, judges, dances and every
              mark. Copy it to another device however suits you — a USB stick, email, a cloud drive or a
              messaging app.
            </Text>

            <Text fw={700} mt="sm">
              Import a competition
            </Text>
            <List type="ordered" spacing="xs">
              <List.Item>
                On the other device, open Podium and go to the{' '}
                <Anchor component={Link} to="/competitions">
                  Competitions
                </Anchor>{' '}
                page.
              </List.Item>
              <List.Item>
                Click <b>Import</b> and choose the <code>.pod</code> file.
              </List.Item>
              <List.Item>
                If that competition is already on the device, choose <b>Replace</b> to overwrite it with the
                file’s version, or <b>Import as copy</b> to keep both.
              </List.Item>
            </List>
            <Text c="dimmed" size="sm">
              Because copies don’t sync, decide which device is the “working” one at any time. If two people
              edit separate copies, their changes can’t be merged — one will have to be re-entered.
            </Text>
          </Section>

          <Section id="install">
            <InstallStatus />
            <Text>
              Podium can be installed as an app. It then gets its own icon and window, opens without the
              browser’s toolbars, and starts straight up offline. Installing is optional — it works just as
              well in a browser tab.
            </Text>
            <List spacing="xs">
              <List.Item>
                <b>Windows or Mac, Chrome or Edge:</b> click the install icon at the right-hand end of the
                address bar (or look for <i>Install Podium</i> in the browser’s menu).
              </List.Item>
              <List.Item>
                <b>Mac, Safari:</b> choose <i>File › Add to Dock</i>.
              </List.Item>
              <List.Item>
                <b>Android, Chrome:</b> open the ⋮ menu and choose <i>Install app</i> or{' '}
                <i>Add to Home screen</i>.
              </List.Item>
              <List.Item>
                <b>iPhone or iPad, Safari:</b> tap the Share button, then <i>Add to Home Screen</i>.
              </List.Item>
            </List>
            <Text c="dimmed" size="sm">
              On a computer the installed app shares its competitions with the browser it was installed from.
              On iPhone and iPad the Home Screen app keeps its own separate storage, so if you have already
              started a competition in Safari, export it there and import it into the app.
            </Text>
          </Section>

          <Section id="updates">
            <Text>
              New versions of Podium are published online. Whenever you open Podium while connected, it checks
              for one and quietly downloads it in the background. When it’s ready, an <b>Update available</b>{' '}
              message appears in the bottom-left corner:
            </Text>
            <List spacing="xs">
              <List.Item>
                Click <b>Reload</b> to switch to the new version straight away, or close the message to keep
                working and update another time.
              </List.Item>
              <List.Item>
                Nothing changes until you click Reload, so an update never interrupts you mid-event.
              </List.Item>
              <List.Item>Your competitions are kept when Podium updates.</List.Item>
              <List.Item>While offline, Podium simply keeps using the version you already have.</List.Item>
            </List>
            <Text>
              The version number is shown at the bottom right of the screen — click it to see what’s new.
            </Text>
          </Section>

          <Section id="checklist">
            <Text>
              A few minutes of preparation, with an internet connection, avoids surprises at the rink:
            </Text>
            <List type="ordered" spacing="xs">
              <List.Item>Open Podium on the competition device and accept any update.</List.Item>
              <List.Item>Install it, so it’s one click away when you are offline.</List.Item>
              <List.Item>Import the competition file if it was set up on a different device.</List.Item>
              <List.Item>
                Turn off Wi-Fi and check Podium still opens and shows the competition — then you are ready.
              </List.Item>
              <List.Item>Export a backup at the end of the day (and at breaks, if you like).</List.Item>
            </List>
          </Section>
        </Stack>
      </Container>
    </>
  );
}

function Section({ id, children }: { id: string; children: ReactNode }) {
  const s = SECTIONS.find((x) => x.id === id)!;
  return (
    <Card withBorder id={id} component="section" className={classes.section}>
      <div className={classes.sectionHead}>
        <ThemeIcon size={40} radius="md" color="navy.9" c="medal.4">
          {s.icon}
        </ThemeIcon>
        <Text component="h2" className="display" fz={28} m={0}>
          {s.title}
        </Text>
      </div>
      <Stack gap="sm">{children}</Stack>
    </Card>
  );
}

/** Tells the user if Podium is already installed, or offers the browser's install prompt when it has one. */
function InstallStatus() {
  const install = useInstallPrompt();
  if (isInstalled())
    return (
      <Alert variant="light" color="teal" title="You’re using the installed app">
        Podium is installed on this device.
      </Alert>
    );
  if (!install) return null;
  return (
    <Alert variant="light" color="podium" title="Your browser can install Podium now">
      <Button mt="xs" size="xs" leftSection={<IconDownload size={14} />} onClick={install}>
        Install Podium
      </Button>
    </Alert>
  );
}
