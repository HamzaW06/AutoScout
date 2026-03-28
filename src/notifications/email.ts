import { config } from '../config.js';
import { logger } from '../logger.js';

/**
 * Send an HTML email via the configured SMTP transport.
 *
 * Currently logs the intent because nodemailer is not in the dependency list.
 * Swap the body of this function for a real nodemailer transport when ready.
 */
export async function sendEmail(
  subject: string,
  htmlBody: string,
): Promise<boolean> {
  if (!config.smtpUser || !config.smtpPass) {
    logger.warn('Email not configured - skipping');
    return false;
  }

  if (!config.notifyEmail) {
    logger.warn('No notifyEmail configured - skipping');
    return false;
  }

  // For a real implementation we would use nodemailer here.
  // Since it is not in deps, log the email and return true.
  logger.info(
    { subject, to: config.notifyEmail, bodyLength: htmlBody.length },
    'Email would be sent',
  );
  return true;
}
