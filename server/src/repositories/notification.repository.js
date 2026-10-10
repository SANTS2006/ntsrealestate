import { prisma } from '../config/database.js';

export function createNotification(data) {
  return prisma.notification.create({ data });
}

export function findNotificationsForUser(userId, organizationId, { skip, take, unreadOnly }) {
  return prisma.notification.findMany({
    where: { userId, organizationId, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function countNotificationsForUser(userId, organizationId, { unreadOnly }) {
  return prisma.notification.count({ where: { userId, organizationId, ...(unreadOnly ? { readAt: null } : {}) } });
}

export function countUnreadForUser(userId, organizationId) {
  return prisma.notification.count({ where: { userId, organizationId, readAt: null } });
}

// Org-wide feed for administrators — every notification, regardless of who
// it was addressed to, with the recipient attached so the admin can see who
// it was for. Never used to give an admin their own read state on someone
// else's notification; readAt still reflects whether the actual recipient
// has read it.
export function findAllNotificationsForOrganization(organizationId, { skip, take, unreadOnly }) {
  return prisma.notification.findMany({
    where: { organizationId, ...(unreadOnly ? { readAt: null } : {}) },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function countAllNotificationsForOrganization(organizationId, { unreadOnly }) {
  return prisma.notification.count({ where: { organizationId, ...(unreadOnly ? { readAt: null } : {}) } });
}

export function countAllUnreadForOrganization(organizationId) {
  return prisma.notification.count({ where: { organizationId, readAt: null } });
}

export function markNotificationRead(id, userId) {
  return prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}

export function markAllNotificationsRead(userId, organizationId) {
  return prisma.notification.updateMany({ where: { userId, organizationId, readAt: null }, data: { readAt: new Date() } });
}

export function findNotificationForViewer(id, organizationId) {
  return prisma.notification.findFirst({ where: { id, organizationId }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } });
}
