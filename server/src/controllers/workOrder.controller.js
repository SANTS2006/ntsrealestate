import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as workOrderService from '../services/workOrder.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await workOrderService.listWorkOrders(req.user.organizationId, req.user, { page, pageSize, skip, take, status: req.query.status, vendorId: req.query.vendorId });
  sendSuccess(res, { data: result.workOrders, meta: result.meta });
});

export const listForMaintenanceRequest = asyncHandler(async (req, res) => {
  const workOrders = await workOrderService.listWorkOrdersForMaintenanceRequest(req.params.maintenanceRequestId, req.user.organizationId, req.user);
  sendSuccess(res, { data: workOrders });
});

export const get = asyncHandler(async (req, res) => {
  const workOrder = await workOrderService.getWorkOrder(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: workOrder });
});

export const create = asyncHandler(async (req, res) => {
  const workOrder = await workOrderService.createWorkOrderRecord(req.params.maintenanceRequestId, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: workOrder, message: 'Work order created.' });
});

export const update = asyncHandler(async (req, res) => {
  const workOrder = await workOrderService.updateWorkOrderRecord(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: workOrder, message: 'Work order updated.' });
});

export const start = asyncHandler(async (req, res) => {
  const workOrder = await workOrderService.startWorkOrder(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: workOrder, message: 'Work order started.' });
});

export const complete = asyncHandler(async (req, res) => {
  const workOrder = await workOrderService.completeWorkOrder(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: workOrder, message: 'Work order completed.' });
});

export const cancel = asyncHandler(async (req, res) => {
  const workOrder = await workOrderService.cancelWorkOrder(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: workOrder, message: 'Work order cancelled.' });
});

export const remove = asyncHandler(async (req, res) => {
  await workOrderService.deleteWorkOrder(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: null, message: 'Work order deleted.' });
});
