import dotenv from 'dotenv';
dotenv.config();

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function cleanEnvString(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/^"|"$/g, '');
}

export const config = {
  // Location
  userLat: parseFloat(process.env.USER_LAT || '29.5111'),
  userLng: parseFloat(process.env.USER_LNG || '-95.1313'),
  userCity: process.env.USER_CITY || 'League City',
  userState: process.env.USER_STATE || 'TX',
  userCounty: process.env.USER_COUNTY || 'Galveston',
  searchRadiusMiles: parseInt(process.env.SEARCH_RADIUS_MILES || '50'),

  // Mechanic
  mechanicLaborMultiplier: parseFloat(process.env.MECHANIC_LABOR_MULTIPLIER || '0.4'),

  // API Keys
  marketCheckApiKey: cleanEnvString(process.env.MARKETCHECK_API_KEY),
  googlePlacesApiKey: cleanEnvString(process.env.GOOGLE_PLACES_API_KEY),
  googleAiApiKey: cleanEnvString(process.env.GOOGLE_AI_API_KEY),
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  vinAuditApiKey: cleanEnvString(process.env.VINAUDIT_API_KEY),

  // Notifications
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  notifyEmail: process.env.NOTIFY_EMAIL || '',
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',

  // Scraping
  requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '2000'),
  maxConcurrentScrapers: parseInt(process.env.MAX_CONCURRENT_SCRAPERS || '3'),
  userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',

  // Server
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '3000'),
  logLevel: process.env.LOG_LEVEL || 'info',
  allowedOrigins: parseCsv(process.env.ALLOWED_ORIGINS),
};
