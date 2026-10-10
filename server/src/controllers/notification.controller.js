import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as notificationService from '../services/notification.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await notificationService.listNotifications(req.user, req.user.organizationId, { page, pageSize, skip, take, unreadOnly: req.query.unreadOnly, all: req.query.all });
  sendSuccess(res, { data: result.notifications, meta: result.meta });
});

export const markRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAsRead(req.params.id, req.user.id);
  sendSuccess(res, { data: result, message: 'Notification marked as read.' });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user.id, req.user.organizationId);
  sendSuccess(res, { data: result, message: 'All notifications marked as read.' });
});

export const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await notificationService.getNotification(req.params.id, req.user) });
});
