import nodemailer from 'nodemailer';
import { env, isProduction, isTest } from '../../config/env.js';
import { logger } from '../../config/logger.js';

// Test-only capture buffer. Verification/reset/invite tokens are only ever
// known in plaintext at the moment they're emailed (the DB stores just a
// hash — see auth/crypto.js), so the integration test suite needs some way
// to observe what "would have been sent" without a real mailbox. This is
// the single, deliberate seam for that; it's inert (never populated) unless
// NODE_ENV=test.
export const sentEmails = [];

const fromName = env.EMAIL_FROM_NAME ?? 'NTS Real Estate System';
const fromAddress = env.EMAIL_FROM_ADDRESS;
// Legacy single-string EMAIL_FROM ("Name <addr>") is still honored if the
// split name/address vars aren't set, so an existing deployment's .env
// keeps working unchanged.
const fromHeader = fromAddress ? `${fromName} <${fromAddress}>` : env.EMAIL_FROM;

const brevoConfigured = Boolean(env.BREVO_API_KEY);
const smtpConfigured = Boolean(env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASSWORD);

if (!brevoConfigured && !smtpConfigured && isProduction) {
  logger.warn('Neither BREVO_API_KEY nor EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD are set — transactional email is disabled in production.');
}

const smtpTransporter = smtpConfigured
  ? nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_PORT === 465,
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
    })
  : null;

// Brevo's transactional HTTP API — the preferred path when BREVO_API_KEY is
// set. Simpler and more reliable than guessing an SMTP login: it's a single
// bearer-style key, no separate SMTP username to get wrong, and failures
// come back as a structured JSON error instead of an opaque SMTP handshake
// failure.
async function sendViaBrevoApi({ to, subject, html, text }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromAddress },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API send failed (${res.status}): ${body}`);
  }
  return res.json();
}

// In development without any provider configured, log the message instead
// of silently dropping it — keeps the verify/reset flows testable locally
// without requiring a real mail provider.
export async function sendMail({ to, subject, html, text }) {
  if (isTest) {
    sentEmails.push({ to, subject, html, text, sentAt: new Date() });
    return { testMode: true };
  }

  if (brevoConfigured) {
    return sendViaBrevoApi({ to, subject, html, text });
  }

  if (smtpTransporter) {
    return smtpTransporter.sendMail({ from: fromHeader, to, subject, html, text });
  }

  logger.info({ to, subject, text }, '[dev email — no provider configured] would have sent email');
  return { devMode: true };
}
