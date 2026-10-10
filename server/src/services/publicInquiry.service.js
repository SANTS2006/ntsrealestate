import { AppError } from '../utils/AppError.js';
import { unitTitle } from '../utils/unitLabel.js';
import { sendMail } from '../integrations/email/mailer.js';
import { listingInquiryEmail, generalContactEmail } from '../integrations/email/templates.js';
import { getListingAgentAssignments } from './publicListing.service.js';
import { findOrganizationById } from '../repositories/organization.repository.js';
import { logger } from '../config/logger.js';

// A listing with no agent currently assigned has nobody to notify — rather
// than silently dropping the lead, it falls back to the organization's own
// general email address so a real person still sees it.
export async function sendListingInquiry(organizationId, { listingId, firstName, lastName, email, phone, message }) {
  const { unit, assignments } = await getListingAgentAssignments(listingId, organizationId);
  if (!unit) throw AppError.notFound('This listing is no longer available.');

  const org = await findOrganizationById(organizationId);
  const listingTitle = unitTitle(unit);
  const { subject, html, text } = listingInquiryEmail({ org, listingTitle, firstName, lastName, email, phone, message });

  const recipients = assignments.length > 0 ? assignments.map((a) => a.user.email) : [];
  if (recipients.length === 0) {
    if (org?.email) recipients.push(org.email);
  }

  await Promise.all(recipients.map((to) =>
    sendMail({ to, subject, html, text }).catch((err) => logger.error({ err, to, listingId }, 'failed to send listing inquiry email'))
  ));

  return { sent: recipients.length > 0 };
}

export async function sendGeneralContact(organizationId, { firstName, lastName, email, phone, message }) {
  const org = await findOrganizationById(organizationId);
  const to = org?.email;
  if (!to) {
    logger.error({ organizationId }, 'general contact form submitted but organization has no email on file');
    return { sent: false };
  }

  const { subject, html, text } = generalContactEmail({ org, firstName, lastName, email, phone, message });
  await sendMail({ to, subject, html, text }).catch((err) => logger.error({ err, to }, 'failed to send general contact email'));
  return { sent: true };
}
