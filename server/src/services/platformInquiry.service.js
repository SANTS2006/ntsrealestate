import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import { sendMail } from '../integrations/email/mailer.js';
import { platformInquiryEmail } from '../integrations/email/templates.js';
import { findAllPlatformAdmins } from '../repositories/platformAdmin.repository.js';
import { platformAudit } from './platformAudit.service.js';

const MAX_NOTIFIED = 10;

// Stores a website Contact / Request-a-demo submission and emails the platform
// team. Saving is what matters: if mail is down or unconfigured the inquiry is
// still in the console, so a failed notification is logged, never surfaced.
export async function createInquiry(input, req) {
  // Honeypot: a real visitor never fills this hidden field. Pretend success so
  // a bot gets no signal, but store and send nothing.
  if (input.website) return { received: true };

  const data = { ...input };
  delete data.website;
  const inquiry = await prisma.platformInquiry.create({
    data: { ...data, ipAddress: req?.ip ?? null },
  });

  notifyPlatformTeam(inquiry).catch((err) => logger.error({ err, inquiryId: inquiry.id }, 'failed to notify platform team of website inquiry'));
  return { received: true };
}

async function notifyPlatformTeam(inquiry) {
  const admins = await findAllPlatformAdmins();
  const addresses = [env.SUPPORT_EMAIL, ...admins.filter((a) => a.isActive).map((a) => a.email)]
    .filter(Boolean)
    .map((e) => e.toLowerCase());
  const to = [...new Set(addresses)].slice(0, MAX_NOTIFIED);
  if (to.length === 0) return;
  const { subject, html, text } = platformInquiryEmail(inquiry);
  await Promise.all(to.map((address) => sendMail({ to: address, subject, html, text })
    .catch((err) => logger.error({ err, to: address }, 'inquiry email failed'))));
}

export async function listInquiries({ page, pageSize, skip, take, status, kind, search }) {
  const where = {
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
            { message: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [inquiries, total, unread] = await Promise.all([
    prisma.platformInquiry.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.platformInquiry.count({ where }),
    prisma.platformInquiry.count({ where: { status: 'new' } }),
  ]);
  return { inquiries, unread, meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function setInquiryStatus(id, status, admin, req) {
  const existing = await prisma.platformInquiry.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Inquiry not found.');
  const inquiry = await prisma.platformInquiry.update({ where: { id }, data: { status } });
  await platformAudit({
    actor: admin, action: 'inquiry.status_changed', targetType: 'inquiry', targetId: id,
    targetLabel: `${existing.name} <${existing.email}>`, details: { from: existing.status, to: status }, req,
  });
  return inquiry;
}

export async function deleteInquiry(id, admin, req) {
  const existing = await prisma.platformInquiry.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Inquiry not found.');
  await prisma.platformInquiry.delete({ where: { id } });
  await platformAudit({
    actor: admin, action: 'inquiry.deleted', targetType: 'inquiry', targetId: id,
    targetLabel: `${existing.name} <${existing.email}>`, req,
  });
}
