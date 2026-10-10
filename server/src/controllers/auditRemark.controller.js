import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import { createRemark, listRemarks } from '../services/auditRemark.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await listRemarks(req.user.organizationId, { page, pageSize, skip, take });
  sendSuccess(res, { data: result.remarks, meta: result.meta });
});

export const create = asyncHandler(async (req, res) => {
  const remark = await createRemark(req.user.organizationId, req.user, req.body.content);
  sendSuccess(res, { statusCode: 201, data: remark, message: 'Remark saved.' });
});
