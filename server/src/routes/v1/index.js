import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { usersRouter } from './users.routes.js';
import { organizationsRouter } from './organizations.routes.js';
import { rolesRouter } from './roles.routes.js';
import { permissionsRouter } from './permissions.routes.js';
import { documentsRouter } from './documents.routes.js';
import { propertiesRouter } from './properties.routes.js';
import { buildingsRouter } from './buildings.routes.js';
import { unitsRouter } from './units.routes.js';
import { ownersRouter } from './owners.routes.js';
import { tenantsRouter } from './tenants.routes.js';
import { leasesRouter } from './leases.routes.js';
import { invoicesRouter, generateInvoiceRouter } from './invoices.routes.js';
import { paymentsRouter } from './payments.routes.js';
import { expensesRouter } from './expenses.routes.js';
import { reportsRouter } from './reports.routes.js';
import { vendorsRouter } from './vendors.routes.js';
import { maintenanceRouter } from './maintenance.routes.js';
import { workOrdersRouter } from './workOrders.routes.js';
import { inspectionsRouter } from './inspections.routes.js';
import { notificationsRouter } from './notifications.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { auditLogsRouter } from './auditLogs.routes.js';
import { auditRemarksRouter } from './auditRemarks.routes.js';
import { tenantMessagesRouter } from './tenantMessages.routes.js';
import { rentalsRouter } from './rentals.routes.js';
import { agentsRouter } from './agents.routes.js';
import { networkRouter } from './network.routes.js';
import { landsRouter } from './lands.routes.js';
import { dealsRouter } from './deals.routes.js';
import { chatRouter } from './chat.routes.js';
import { referralsRouter } from './referrals.routes.js';
import { publicRouter } from './public.routes.js';
import { platformAdminRouter } from './platformAdmin.routes.js';
import { tenantAuthRouter } from './tenantAuth.routes.js';
import { cronRun } from '../../controllers/backup.controller.js';
import { clientErrorsRouter } from './clientErrors.routes.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// /settings is covered by PATCH /organizations/me (Phase 5) — organization
// settings live in Organization.settings (JSONB), so no separate resource
// was added for it. See docs/api/api-guide.md.
export const v1Router = Router();

v1Router.use('/health', healthRouter);
v1Router.use('/client-errors', clientErrorsRouter);
v1Router.post('/internal/backups/run', asyncHandler(cronRun));
// Mounted early, deliberately — buildingsRouter/unitsRouter/generateInvoiceRouter
// below are mounted at this router's own root ('/') and apply `authenticate`
// unconditionally to every request that reaches them, regardless of path.
// Registering `/public` after them would mean an unauthenticated public-site
// request gets rejected by one of those routers' auth check before Express
// ever tries matching it against `/public`'s own routes.
v1Router.use('/public', publicRouter);
// Also mounted early for the same reason — /platform-admin and /orgs are
// distinct static prefixes, but the root-mounted buildingsRouter/
// unitsRouter/generateInvoiceRouter below would still swallow them first
// if registered after those.
v1Router.use('/platform-admin', platformAdminRouter);
// Before any router mounted at '/' (they apply tenant-only authentication to
// everything that follows them) — chat serves platform admins as well.
v1Router.use('/chat', chatRouter);
v1Router.use('/orgs/:orgSlug', tenantAuthRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/organizations', organizationsRouter);
v1Router.use('/roles', rolesRouter);
v1Router.use('/permissions', permissionsRouter);
v1Router.use('/documents', documentsRouter);
v1Router.use('/properties', propertiesRouter);
// buildingsRouter/unitsRouter define their own full paths (both a nested
// collection under a parent and a standalone-by-id route) — see their
// files for why they're mounted at the v1 root instead of a fixed prefix.
v1Router.use('/', buildingsRouter);
v1Router.use('/', unitsRouter);
v1Router.use('/owners', ownersRouter);
v1Router.use('/tenants', tenantsRouter);
v1Router.use('/leases', leasesRouter);
v1Router.use('/invoices', invoicesRouter);
// generateInvoiceRouter defines /leases/:leaseId/generate-invoice — mounted
// at the v1 root for the same reason as buildings/units above.
v1Router.use('/', generateInvoiceRouter);
v1Router.use('/payments', paymentsRouter);
v1Router.use('/expenses', expensesRouter);
v1Router.use('/reports', reportsRouter);
v1Router.use('/vendors', vendorsRouter);
v1Router.use('/maintenance', maintenanceRouter);
v1Router.use('/work-orders', workOrdersRouter);
v1Router.use('/inspections', inspectionsRouter);
v1Router.use('/notifications', notificationsRouter);
v1Router.use('/dashboard', dashboardRouter);
v1Router.use('/audit-logs', auditLogsRouter);
v1Router.use('/audit-remarks', auditRemarksRouter);
v1Router.use('/tenant-messages', tenantMessagesRouter);
v1Router.use('/rentals', rentalsRouter);
v1Router.use('/agents', agentsRouter);
v1Router.use('/network', networkRouter);
v1Router.use('/lands', landsRouter);
v1Router.use('/deals', dealsRouter);
v1Router.use('/referrals', referralsRouter);
