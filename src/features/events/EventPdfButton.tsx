import { Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconFileTypePdf } from '@tabler/icons-react';
import type { CompEvent } from '../../domain/types';
import classes from './EventPdfButton.module.css';
import { EventPdfModal } from './EventPdfModal';

/** The event's PDF button, beside its tabs: opens the PDF launchpad. */
export function EventPdfButton({ event }: { event: CompEvent }) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Button
        variant="white"
        color="navy.9"
        aria-label="PDFs"
        className={classes.button}
        classNames={{ label: classes.label, section: classes.section }}
        leftSection={<IconFileTypePdf size={16} />}
        onClick={open}
      >
        PDFs
      </Button>
      <EventPdfModal event={event} opened={opened} onClose={close} />
    </>
  );
}
