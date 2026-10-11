import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createNotification, findNotificationsForUser, countNotificationsForUser,
  countUnreadForUser, markNotificationRead, markAllNotificationsRead,
  findAllNotificationsForOrganization, countAllNotificationsForOrganization, countAllUnreadForOrganization,
  findNotificationForViewer,
} from '../repositories/notification.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import { sendMail } from '../integrations/email/mailer.js';
import { findOrganizationById } from '../repositories/organization.repository.js';
import { notificationEmail } from '../integrations/email/templates.js';
import { logger } from '../config/logger.js';
import { emitToActor } from '../realtime/hub.js';

function serializeNotification(notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    // Only present on the admin org-wide feed (see listNotifications) —
    // findNotificationsForUser (the self-scoped path) never includes it.
    ...(notification.user ? { recipient: { id: notification.user.id, firstName: notification.user.firstName, lastName: notification.user.lastName, email: notification.user.email } } : {}),
  };
}

// Called from other services at the point an event actually happens (see
// maintenance/work-order/payment/lease/invoice/auditRemark services for the
// current hooks) — never from a controller. Failure here must never fail
// the operation that triggered it (a maintenance assignment succeeding
// shouldn't roll back because a notification row failed to insert), so
// errors are logged and swallowed, mirroring audit.service.js's own
// failure posture. Every notify() also emails the recipient by default —
// pass `sendEmail: false` when the calling service already sends its own
// richer, event-specific template (e.g. inspectionScheduledEmail) so the
// recipient isn't emailed twice for the one event.
export async function notify({ organizationId, userId, type, title, message, sendEmail = true }) {
  if (!userId) return; // e.g. a tenant with no linked user account yet
  try {
    const created = await createNotification({ organizationId, userId, type, title, message });
    // Live: every open tab/device of this person hears about it straight away
    // (nothing happens if they are offline — they see it on their next visit).
    emitToActor(`u:${userId}`, 'notification:new', serializeNotification(created));
  } catch (err) {
    logger.error({ err, userId, type }, 'failed to create notification');
  }

  if (!sendEmail) return;
  try {
    const [user, org] = await Promise.all([findUserById(userId, organizationId), findOrganizationById(organizationId)]);
    if (!user?.email || !org) return;
    const { subject, html, text } = notificationEmail({ org, title, message });
    await sendMail({ to: user.email, subject, html, text });
  } catch (err) {
    logger.error({ err, userId, type }, 'failed to email notification');
  }
}

export async function listNotifications(actingUser, organizationId, { page, pageSize, skip, take, unreadOnly, all }) {
  // `all` only ever takes effect for an administrator — anyone else asking
  // for it silently gets their own notifications instead, same posture as
  // every other UX-only query flag in this codebase (the real boundary is
  // never trusting the caller's own claim about their role).
  if (all && actingUser.roles.includes('administrator')) {
    const [notifications, total, unreadCount] = await Promise.all([
      findAllNotificationsForOrganization(organizationId, { skip, take, unreadOnly }),
      countAllNotificationsForOrganization(organizationId, { unreadOnly }),
      countAllUnreadForOrganization(organizationId),
    ]);
    return {
      notifications: notifications.map(serializeNotification),
      meta: { ...buildPaginationMeta({ page, pageSize, total }), unreadCount },
    };
  }

  const [notifications, total, unreadCount] = await Promise.all([
    findNotificationsForUser(actingUser.id, organizationId, { skip, take, unreadOnly }),
    countNotificationsForUser(actingUser.id, organizationId, { unreadOnly }),
    countUnreadForUser(actingUser.id, organizationId),
  ]);
  return {
    notifications: notifications.map(serializeNotification),
    meta: { ...buildPaginationMeta({ page, pageSize, total }), unreadCount },
  };
}

export async function markAsRead(id, userId) {
  const result = await markNotificationRead(id, userId);
  if (result.count === 0) throw AppError.notFound('Notification not found.');
  emitToActor(`u:${userId}`, 'notification:read', { id });
  return { read: true };
}

export async function markAllAsRead(userId, organizationId) {
  const result = await markAllNotificationsRead(userId, organizationId);
  emitToActor(`u:${userId}`, 'notification:read-all', {});
  return { markedRead: result.count };
}

// One notification in full. Your own, or any in the organisation for an
// administrator. Opening your own marks it read.
export async function getNotification(id, actingUser) {
  const n = await findNotificationForViewer(id, actingUser.organizationId);
  const mine = n && n.userId === actingUser.id;
  if (!n || (!mine && !actingUser.roles.includes('administrator'))) throw AppError.notFound('Notification not found.');
  if (mine && !n.readAt) {
    await markNotificationRead(id, actingUser.id);
    n.readAt = new Date();
  }
  return { ...serializeNotification(n), recipient: { id: n.user.id, firstName: n.user.firstName, lastName: n.user.lastName, email: n.user.email }, mine };
}
