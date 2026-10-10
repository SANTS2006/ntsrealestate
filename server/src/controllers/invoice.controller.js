import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as invoiceService from '../services/invoice.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await invoiceService.listInvoices(req.user.organizationId, req.user, {
    page, pageSize, skip, take, status: req.query.status, tenantId: req.query.tenantId, leaseId: req.query.leaseId,
  });
  sendSuccess(res, { data: result.invoices, meta: result.meta });
});

export const get = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoice(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: invoice });
});

export const create = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.createInvoiceRecord(req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: invoice, message: 'Invoice created as a draft.' });
});

export const generateFromLease = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.generateInvoiceFromLease(req.params.leaseId, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: invoice, message: 'Invoice generated and sent.' });
});

export const update = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.updateInvoiceRecord(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: invoice, message: 'Invoice updated.' });
});

export const send = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.sendInvoice(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: invoice, message: 'Invoice sent.' });
});

export const voidInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.voidInvoice(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: invoice, message: 'Invoice voided.' });
});

export const remove = asyncHandler(async (req, res) => {
  await invoiceService.deleteInvoice(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: null, message: 'Invoice deleted.' });
});
