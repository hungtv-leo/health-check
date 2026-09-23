import { env } from './config';

export type DiscordLevel = 'FAIL' | 'WARNING' | 'INFO';

export type DiscordField = {
  name: string;
  value: string;
  inline?: boolean;
};

/** Discord embed limits */
const DESC_LIMIT = 3500;
const FIELD_VALUE_LIMIT = 1000;

export async function notifyDiscord(opts: {
  title: string;
  level: DiscordLevel;
  details?: string;
  fields?: DiscordField[];
  footer?: string;
}): Promise<void> {
  if (!env.discordWebhook) return;

  const color =
    opts.level === 'FAIL' ? 0xe74c3c : opts.level === 'WARNING' ? 0xf1c40f : 0x2ecc71;

  const fields = (opts.fields || [])
    .filter((f) => f.value.trim())
    .map((f) => ({
      name: f.name.slice(0, 256),
      value: f.value.slice(0, FIELD_VALUE_LIMIT),
      inline: f.inline ?? false,
    }))
    .slice(0, 25);

  const body = {
    embeds: [
      {
        title: opts.title.slice(0, 256),
        description: opts.details ? opts.details.slice(0, DESC_LIMIT) : undefined,
        color,
        fields: fields.length ? fields : undefined,
        timestamp: new Date().toISOString(),
        footer: { text: opts.footer || 'Auto Check Web Học Thi' },
      },
    ],
  };

  try {
    const res = await fetch(env.discordWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn('Discord notify HTTP', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.warn('Discord notify failed:', err);
  }
}
