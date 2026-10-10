import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { sendMail } from '../integrations/email/mailer.js';
import { maintenanceEmail } from '../integrations/email/templates.js';
import { platformAudit } from './platformAudit.service.js';

const KEY = 'maintenance';

// The parts of the system a notice can be shown on. `website` is the public
// listings site; the others are areas of the application.
export const MAINTENANCE_PAGE_GROUPS = [
  'website', 'home', 'signin', 'dashboard', 'properties', 'people', 'deals', 'finance', 'maintenance', 'chat', 'admin', 'platform',
];

const DEFAULTS = { enabled: false, message: '', scope: 'all', pages: [], endsAt: null, startedAt: null, lastNotice: null };

let cache = { at: 0, value: DEFAULTS };

export async function getMaintenance() {
  const row = await prisma.platformSetting.findUnique({ where: { key: KEY } });
  return { ...DEFAULTS, ...(row?.value ?? {}) };
}

// What the public status endpoint returns — read often by every open page,
// so it is held in memory for a few seconds.
export async function getPublicMaintenanceStatus() {
  if (Date.now() - cache.at < 10_000) return cache.value;
  const m = await getMaintenance();
  const value = m.enabled
    ? { enabled: true, message: m.message, scope: m.scope, pages: m.scope === 'selected' ? m.pages : [], endsAt: m.endsAt, startedAt: m.startedAt }
    : { enabled: false };
  cache = { at: Date.now(), value };
  return value;
}

// Everyone with an active account in an active company hears about it.
async function emailEveryone(settings) {
  const users = await prisma.user.findMany({
    where: { status: 'active', organization: { status: 'active' } },
    select: {
      email: true, firstName: true,
      organization: { select: { name: true, slug: true, primaryColor: true, secondaryColor: true, email: true } },
    },
  });
  let sent = 0;
  let failed = 0;
  const BATCH = 15;
  for (let i = 0; i < users.length; i += BATCH) {
    const batch = users.slice(i, i + BATCH);
    await Promise.all(batch.map(async (u) => {
      try {
        const { subject, html, text } = maintenanceEmail({ org: u.organization, firstName: u.firstName, message: settings.message, endsAt: settings.endsAt });
        await sendMail({ to: u.email, subject, html, text });
        sent += 1;
      } catch (err) {
        failed += 1;
        logger.warn({ err: err.message }, 'maintenance notice email failed');
      }
    }));
    if (i + BATCH < users.length) await new Promise((r) => setTimeout(r, 1000));
  }
  return { at: new Date().toISOString(), sent, failed, total: users.length };
}

async function save(value) {
  await prisma.platformSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  cache = { at: 0, value: DEFAULTS };
}

// Turns maintenance mode on or off. When it is switched on (or its message
// is re-sent) and `notifyUsers` is true, every user is emailed in the
// background; the result is stored so the platform admin can see it.
export async function setMaintenance(input, admin, req) {
  const before = await getMaintenance();
  const turningOn = input.enabled && !before.enabled;
  const next = {
    ...before,
    enabled: input.enabled,
    message: input.message ?? before.message,
    scope: input.scope ?? before.scope,
    pages: input.scope === 'all' ? [] : (input.pages ?? before.pages),
    endsAt: input.endsAt === undefined ? before.endsAt : input.endsAt,
    startedAt: input.enabled ? (before.enabled ? before.startedAt : new Date().toISOString()) : null,
  };
  await save(next);

  await platformAudit({
    actor: admin,
    action: input.enabled ? (turningOn ? 'maintenance.enabled' : 'maintenance.updated') : 'maintenance.disabled',
    targetType: 'platform', targetId: null, targetLabel: 'Maintenance mode',
    details: { scope: next.scope, pages: next.pages, notifyUsers: Boolean(input.notifyUsers) }, req,
  });

  if (input.enabled && input.notifyUsers) {
    // Not awaited: there can be many users, and sending takes a while.
    emailEveryone(next)
      .then((lastNotice) => save({ ...next, lastNotice }))
      .catch((err) => logger.error({ err }, 'maintenance notice failed'));
    next.lastNotice = { at: new Date().toISOString(), sending: true };
    await save(next);
  }
  return next;
}
