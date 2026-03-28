import { config } from '../config.js';
import { logger } from '../logger.js';

/**
 * Post a message (with optional embeds) to the configured Discord webhook.
 */
export async function sendDiscordAlert(
  content: string,
  embeds?: object[],
): Promise<boolean> {
  if (!config.discordWebhookUrl) {
    logger.debug('Discord not configured - skipping');
    return false;
  }

  try {
    const resp = await fetch(config.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, embeds }),
    });

    if (!resp.ok) {
      logger.warn({ status: resp.status }, 'Discord webhook failed');
      return false;
    }
    return true;
  } catch (err) {
    logger.error(err, 'Discord send error');
    return false;
  }
}

// ---------------------------------------------------------------------------
// Embed helpers
// ---------------------------------------------------------------------------

const RATING_COLORS: Record<string, number> = {
  STEAL: 0x00c853,   // green
  GREAT: 0x00c853,   // green
  GOOD: 0x2196f3,    // blue
  FAIR: 0xff9800,    // orange
  HIGH: 0xf44336,    // red
  'RIP-OFF': 0xf44336,
};

/**
 * Build a Discord embed object for a single listing.
 */
export function formatListingEmbed(listing: Record<string, unknown>): object {
  const rating = (listing.value_rating as string) ?? 'N/A';
  const year = listing.year ?? '??';
  const make = listing.make ?? 'Unknown';
  const model = listing.model ?? 'Unknown';
  const price = listing.asking_price != null
    ? `$${Number(listing.asking_price).toLocaleString()}`
    : 'N/A';

  const title = `${rating}: ${year} ${make} ${model} - ${price}`;

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: 'Price', value: price, inline: true },
    {
      name: 'Market Value',
      value: listing.market_value != null
        ? `$${Number(listing.market_value).toLocaleString()}`
        : 'N/A',
      inline: true,
    },
    {
      name: 'Mileage',
      value: listing.mileage != null
        ? `${Number(listing.mileage).toLocaleString()} mi`
        : 'N/A',
      inline: true,
    },
    {
      name: 'Risk Score',
      value: listing.risk_score != null ? String(listing.risk_score) : 'N/A',
      inline: true,
    },
    {
      name: 'Location',
      value: (listing.seller_location as string) ?? 'N/A',
      inline: true,
    },
  ];

  return {
    title,
    color: RATING_COLORS[rating] ?? 0x9e9e9e,
    fields,
    ...(listing.source_url ? { url: listing.source_url as string } : {}),
  };
}
