// ── Alert Check ─────────────────────────────────────────────────────────────
// Determines whether to fire alerts for exceptional deals and sends them.
// ----------------------------------------------------------------------------

import { sendDiscordAlert } from '../notifications/discord.js';
import { logger } from '../logger.js';
import { emitAlert } from '../websocket.js';

export type AlertType = 'steal' | 'great_deal' | 'price_drop';

export interface AlertInput {
  value_rating: string;
  deal_score: number;
  price: number;
  year: number;
  make: string;
  model: string;
  listing_url?: string;
  id?: string;
}

/**
 * Pure function that returns the list of alert types that should fire
 * for the given input.
 */
export function shouldFireAlert(input: AlertInput): AlertType[] {
  const alerts: AlertType[] = [];

  if (input.value_rating === 'STEAL') {
    alerts.push('steal');
  } else if (input.value_rating === 'GREAT') {
    alerts.push('great_deal');
  }

  return alerts;
}

/**
 * Fires Discord alerts for exceptional deals.
 * Non-blocking – Discord errors are caught and logged, not re-thrown.
 */
export async function fireAlerts(input: AlertInput): Promise<void> {
  const alerts = shouldFireAlert(input);

  if (alerts.length === 0) {
    return;
  }

  const title = `${input.year} ${input.make} ${input.model}`;

  for (const alert of alerts) {
    const emoji = alert === 'steal' ? '🔥' : '⭐';
    const message = `${emoji} **${title}** — $${input.price} (${input.deal_score}% below market)`;

    logger.info({ alert, id: input.id, make: input.make, model: input.model }, `Firing ${alert} alert`);

    try {
      await sendDiscordAlert(message, []);
    } catch (err) {
      logger.error(err, `Failed to send Discord alert for ${alert}`);
    }

    // Emit deal_alert WebSocket event
    emitAlert(alert, {
      year: input.year,
      make: input.make,
      model: input.model,
      price: input.price,
      deal_score: input.deal_score,
    });
  }
}
