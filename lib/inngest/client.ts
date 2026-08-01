import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'veracity' });

export function inngestConfigured(): boolean {
  return Boolean(
    process.env.INNGEST_EVENT_KEY?.trim() ||
      process.env.INNGEST_DEV === '1',
  );
}
