import type { AlertEventRow } from '@/lib/alerts';

export type AlertEgressChannel = 'email' | 'slack';
export type AlertEgressStatus = 'sent' | 'skipped' | 'failed';

export type AlertEgressResult = {
  channel: AlertEgressChannel;
  status: AlertEgressStatus;
  error?: string;
};

export async function deliverAlertEgress(input: {
  userId: string;
  userEmail?: string | null;
  alert: AlertEventRow;
  channels: string[];
  fetchImpl?: typeof fetch;
}): Promise<AlertEgressResult[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const requested = [...new Set(input.channels)]
    .filter((channel): channel is AlertEgressChannel =>
      channel === 'email' || channel === 'slack',
    );
  const results = await Promise.all(requested.map(async (channel) => {
    const result = channel === 'slack'
      ? await sendSlackAlert(input.alert, fetchImpl)
      : await sendEmailAlert(input.alert, input.userEmail, fetchImpl);
    await recordAlertDelivery(input.userId, input.alert.id, result).catch(() => {});
    return result;
  }));
  return results;
}

export async function sendSlackAlert(
  alert: AlertEventRow,
  fetchImpl: typeof fetch = fetch,
): Promise<AlertEgressResult> {
  const webhook = process.env.SLACK_ALERT_WEBHOOK_URL?.trim();
  if (!webhook) {
    return { channel: 'slack', status: 'skipped', error: 'Slack webhook is not configured.' };
  }
  try {
    const response = await fetchImpl(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${escapeSlack(alert.title)}*\n${escapeSlack(alert.summary)}`,
            },
          },
          {
            type: 'context',
            elements: [{
              type: 'mrkdwn',
              text: `${escapeSlack(alert.product)} · ${escapeSlack(alert.competitor)} · ${alert.severity}`,
            }],
          },
        ],
      }),
    });
    if (!response.ok) {
      return { channel: 'slack', status: 'failed', error: `Slack returned ${response.status}.` };
    }
    return { channel: 'slack', status: 'sent' };
  } catch (error) {
    return { channel: 'slack', status: 'failed', error: safeError(error) };
  }
}

export async function sendEmailAlert(
  alert: AlertEventRow,
  recipient: string | null | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<AlertEgressResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ALERT_FROM_EMAIL?.trim();
  if (!apiKey || !from || !recipient) {
    return {
      channel: 'email',
      status: 'skipped',
      error: 'Email provider, sender, or recipient is not configured.',
    };
  }
  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        text: [
          alert.title,
          '',
          alert.summary,
          '',
          `Product: ${alert.product}`,
          `Competitor: ${alert.competitor}`,
          `Severity: ${alert.severity}`,
        ].join('\n'),
      }),
    });
    if (!response.ok) {
      return { channel: 'email', status: 'failed', error: `Email provider returned ${response.status}.` };
    }
    return { channel: 'email', status: 'sent' };
  } catch (error) {
    return { channel: 'email', status: 'failed', error: safeError(error) };
  }
}

async function recordAlertDelivery(
  userId: string,
  alertId: string,
  result: AlertEgressResult,
): Promise<void> {
  const { query } = await import('@/lib/db');
  await query(
    `INSERT INTO alert_deliveries (user_id, alert_id, channel, status, error)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (alert_id, channel) DO UPDATE SET
       status = EXCLUDED.status,
       error = EXCLUDED.error,
       created_at = now()`,
    [userId, alertId, result.channel, result.status, result.error ?? null],
  );
}

function escapeSlack(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : 'Connector request failed').slice(0, 240);
}

