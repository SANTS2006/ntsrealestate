import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as inquiryService from '../services/platformInquiry.service.js';

// Public, anonymous (the marketing website's forms).
export const create = asyncHandler(async (req, res) => {
  const data = await inquiryService.createInquiry(req.body, req);
  sendSuccess(res, { statusCode: 201, data, message: 'Thank you — your message has been received.' });
});

// Platform admin console.
export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const { status, kind, search } = req.query;
  const result = await inquiryService.listInquiries({ page, pageSize, skip, take, status, kind, search });
  sendSuccess(res, { data: { inquiries: result.inquiries, unread: result.unread }, meta: result.meta });
});

export const setStatus = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    data: await inquiryService.setInquiryStatus(req.params.id, req.body.status, req.platformAdmin, req),
    message: 'Inquiry updated.',
  });
});

export const remove = asyncHandler(async (req, res) => {
  await inquiryService.deleteInquiry(req.params.id, req.platformAdmin, req);
  sendSuccess(res, { message: 'Inquiry deleted.' });
});
