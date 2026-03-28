import { getDb } from '../db/database.js';
import { logger } from '../logger.js';
import { sendEmail } from './email.js';
import { sendDiscordAlert, formatListingEmbed } from './discord.js';
import type { ListingRow } from '../db/queries.js';

// ---------------------------------------------------------------------------
// Daily Digest
// ---------------------------------------------------------------------------

export async function sendDailyDigest(): Promise<void> {
  const db = getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  // 1. Top 5 new listings by deal_score (from today)
  const topDeals = db.all<ListingRow>(
    `SELECT * FROM listings
     WHERE is_active = 1 AND first_seen >= ? AND deal_score IS NOT NULL
     ORDER BY deal_score DESC
     LIMIT 5`,
    [todayISO],
  );

  // 2. Price drops on favorited listings
  const priceDropFavorites = db.all<ListingRow>(
    `SELECT * FROM listings
     WHERE is_active = 1 AND is_favorite = 1 AND price_dropped = 1`,
  );

  // 3. Count of new listings added today
  const countRow = db.get<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM listings WHERE first_seen >= ?`,
    [todayISO],
  );
  const newCount = countRow?.cnt ?? 0;

  // 4. Format HTML email
  const dealRows = topDeals
    .map(
      (l) =>
        `<tr>
          <td>${l.year} ${l.make} ${l.model}</td>
          <td>$${l.asking_price.toLocaleString()}</td>
          <td>${l.market_value != null ? '$' + l.market_value.toLocaleString() : 'N/A'}</td>
          <td>${l.value_rating ?? 'N/A'}</td>
          <td>${l.deal_score ?? 'N/A'}</td>
        </tr>`,
    )
    .join('\n');

  const priceDropRows = priceDropFavorites
    .map(
      (l) =>
        `<li>${l.year} ${l.make} ${l.model} - now $${l.asking_price.toLocaleString()} (${l.price_drop_count} drop${l.price_drop_count !== 1 ? 's' : ''})</li>`,
    )
    .join('\n');

  const html = `
    <h2>AutoScout Daily Digest</h2>
    <p><strong>${newCount}</strong> new listing${newCount !== 1 ? 's' : ''} added today.</p>

    <h3>Top Deals</h3>
    ${
      topDeals.length > 0
        ? `<table border="1" cellpadding="4">
            <tr><th>Vehicle</th><th>Price</th><th>Market</th><th>Rating</th><th>Score</th></tr>
            ${dealRows}
           </table>`
        : '<p>No scored listings today.</p>'
    }

    ${
      priceDropFavorites.length > 0
        ? `<h3>Price Drops on Favorites</h3><ul>${priceDropRows}</ul>`
        : ''
    }
  `;

  // 5. Send via email
  await sendEmail('AutoScout Daily Digest', html);

  // 6. Send Discord summary
  const discordLines = [
    `**AutoScout Daily Digest** - ${newCount} new listing${newCount !== 1 ? 's' : ''} today`,
  ];
  if (topDeals.length > 0) {
    discordLines.push('**Top Deals:**');
    for (const l of topDeals) {
      discordLines.push(
        `- ${l.value_rating ?? '?'}: ${l.year} ${l.make} ${l.model} - $${l.asking_price.toLocaleString()}`,
      );
    }
  }
  if (priceDropFavorites.length > 0) {
    discordLines.push(`**${priceDropFavorites.length} favorite(s) with price drops**`);
  }
  await sendDiscordAlert(discordLines.join('\n'));

  logger.info(
    { newCount, topDeals: topDeals.length, priceDrops: priceDropFavorites.length },
    'Daily digest sent',
  );
}

// ---------------------------------------------------------------------------
// Weekly Report
// ---------------------------------------------------------------------------

export async function sendWeeklyReport(): Promise<void> {
  const db = getDb();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const weekAgoISO = weekAgo.toISOString();
  const twoWeeksAgoISO = twoWeeksAgo.toISOString();

  // 1. Best deals of the week
  const bestDeals = db.all<ListingRow>(
    `SELECT * FROM listings
     WHERE is_active = 1 AND first_seen >= ? AND deal_score IS NOT NULL
     ORDER BY deal_score DESC
     LIMIT 10`,
    [weekAgoISO],
  );

  // 2. Market trends - average price this week vs last
  const thisWeekAvg = db.get<{ avg_price: number | null }>(
    `SELECT AVG(asking_price) AS avg_price FROM listings WHERE first_seen >= ?`,
    [weekAgoISO],
  );
  const lastWeekAvg = db.get<{ avg_price: number | null }>(
    `SELECT AVG(asking_price) AS avg_price FROM listings
     WHERE first_seen >= ? AND first_seen < ?`,
    [twoWeeksAgoISO, weekAgoISO],
  );

  // 3. Dealer activity
  const dealerActivity = db.all<{ source: string; cnt: number }>(
    `SELECT source, COUNT(*) AS cnt FROM listings
     WHERE first_seen >= ?
     GROUP BY source ORDER BY cnt DESC LIMIT 10`,
    [weekAgoISO],
  );

  // 4. New listing count for the week
  const weekCountRow = db.get<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM listings WHERE first_seen >= ?`,
    [weekAgoISO],
  );
  const weekCount = weekCountRow?.cnt ?? 0;

  const avgThis = thisWeekAvg?.avg_price;
  const avgLast = lastWeekAvg?.avg_price;
  const trendText =
    avgThis != null && avgLast != null && avgLast > 0
      ? `$${Math.round(avgThis).toLocaleString()} (${avgThis > avgLast ? '+' : ''}${(((avgThis - avgLast) / avgLast) * 100).toFixed(1)}% vs last week)`
      : 'N/A';

  const dealRows = bestDeals
    .map(
      (l) =>
        `<tr>
          <td>${l.year} ${l.make} ${l.model}</td>
          <td>$${l.asking_price.toLocaleString()}</td>
          <td>${l.value_rating ?? 'N/A'}</td>
          <td>${l.deal_score ?? 'N/A'}</td>
        </tr>`,
    )
    .join('\n');

  const dealerRows = dealerActivity
    .map((d) => `<li>${d.source}: ${d.cnt} listing${d.cnt !== 1 ? 's' : ''}</li>`)
    .join('\n');

  const html = `
    <h2>AutoScout Weekly Report</h2>
    <p><strong>${weekCount}</strong> new listing${weekCount !== 1 ? 's' : ''} this week.</p>
    <p><strong>Avg Price Trend:</strong> ${trendText}</p>

    <h3>Best Deals This Week</h3>
    ${
      bestDeals.length > 0
        ? `<table border="1" cellpadding="4">
            <tr><th>Vehicle</th><th>Price</th><th>Rating</th><th>Score</th></tr>
            ${dealRows}
           </table>`
        : '<p>No scored listings this week.</p>'
    }

    <h3>Dealer Activity</h3>
    <ul>${dealerRows}</ul>
  `;

  await sendEmail('AutoScout Weekly Report', html);

  // Discord summary
  const lines = [
    `**AutoScout Weekly Report** - ${weekCount} new listings`,
    `Avg Price: ${trendText}`,
  ];
  if (bestDeals.length > 0) {
    lines.push('**Top 5 Deals:**');
    for (const l of bestDeals.slice(0, 5)) {
      lines.push(
        `- ${l.value_rating ?? '?'}: ${l.year} ${l.make} ${l.model} - $${l.asking_price.toLocaleString()}`,
      );
    }
  }
  await sendDiscordAlert(lines.join('\n'));

  logger.info({ weekCount, bestDeals: bestDeals.length }, 'Weekly report sent');
}

// ---------------------------------------------------------------------------
// Single Steal Alert
// ---------------------------------------------------------------------------

/**
 * Send an immediate alert for STEAL/GREAT rated listings.
 */
export async function sendStealAlert(
  listing: Record<string, unknown>,
): Promise<void> {
  const embed = formatListingEmbed(listing);
  await sendDiscordAlert('New deal found!', [embed]);
  await sendEmail(
    `AutoScout Alert: ${listing.value_rating} - ${listing.year} ${listing.make} ${listing.model}`,
    `<h2>${listing.value_rating}: ${listing.year} ${listing.make} ${listing.model}</h2>
     <p>Price: $${listing.asking_price} | Market: $${listing.market_value ?? 'N/A'}</p>
     <p><a href="${listing.source_url ?? '#'}">View Listing</a></p>`,
  );
  logger.info(
    { rating: listing.value_rating, make: listing.make, model: listing.model },
    'Steal alert sent',
  );
}
