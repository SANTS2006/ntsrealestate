import { Suspense } from 'react';
import { lazyWithRetry as lazy } from './utils/lazyWithRetry.js';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { BrandingProvider } from './contexts/BrandingContext.jsx';
import { PlatformAdminProvider } from './contexts/PlatformAdminContext.jsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx';
import { PlatformAdminProtectedRoute } from './components/auth/PlatformAdminProtectedRoute.jsx';
import { DashboardLayout } from './layouts/DashboardLayout.jsx';
import { LoadingState } from './components/ui/Spinner.jsx';
import LandingPage from './pages/LandingPage.jsx';
import { BareAuthRedirect } from './components/auth/BareAuthRedirect.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RentPage from './pages/auth/RentPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import CheckEmailPage from './pages/auth/CheckEmailPage.jsx';
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import PlatformAdminLoginPage from './pages/platformAdmin/PlatformAdminLoginPage.jsx';
import PlatformAdminForgotPasswordPage from './pages/platformAdmin/PlatformAdminForgotPasswordPage.jsx';
import PlatformAdminResetPasswordPage from './pages/platformAdmin/PlatformAdminResetPasswordPage.jsx';
import PlatformAdminLayout from './layouts/PlatformAdminLayout.jsx';

// Every authenticated page is lazy-loaded — the auth screens above stay
// eager since they're on the critical path for every first visit, but
// nothing past the login wall should be in that initial bundle.
const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const PropertiesListPage = lazy(() => import('./pages/properties/PropertiesListPage.jsx'));
const PropertyDetailPage = lazy(() => import('./pages/properties/PropertyDetailPage.jsx'));
const TenantsListPage = lazy(() => import('./pages/tenants/TenantsListPage.jsx'));
const MessageManagerPage = lazy(() => import('./pages/tenants/MessageManagerPage.jsx'));
const TenantMessagesInboxPage = lazy(() => import('./pages/tenants/TenantMessagesInboxPage.jsx'));
const OwnersListPage = lazy(() => import('./pages/owners/OwnersListPage.jsx'));
const LeasesListPage = lazy(() => import('./pages/leases/LeasesListPage.jsx'));
const MyLeasePage = lazy(() => import('./pages/leases/MyLeasePage.jsx'));
const InvoicesListPage = lazy(() => import('./pages/finance/InvoicesListPage.jsx'));
const PaymentsListPage = lazy(() => import('./pages/finance/PaymentsListPage.jsx'));
const ExpensesListPage = lazy(() => import('./pages/finance/ExpensesListPage.jsx'));
const MyPaymentsPage = lazy(() => import('./pages/finance/MyPaymentsPage.jsx'));
const MaintenanceRequestsListPage = lazy(() => import('./pages/maintenance/MaintenanceRequestsListPage.jsx'));
const MaintenanceRequestDetailPage = lazy(() => import('./pages/maintenance/MaintenanceRequestDetailPage.jsx'));
const WorkOrdersListPage = lazy(() => import('./pages/maintenance/WorkOrdersListPage.jsx'));
const VendorsListPage = lazy(() => import('./pages/vendors/VendorsListPage.jsx'));
const InspectionsListPage = lazy(() => import('./pages/inspections/InspectionsListPage.jsx'));
const InspectionDetailPage = lazy(() => import('./pages/inspections/InspectionDetailPage.jsx'));
const UsersRolesPage = lazy(() => import('./pages/users/UsersRolesPage.jsx'));
const RoleDetailPage = lazy(() => import('./pages/roles/RoleDetailPage.jsx'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage.jsx'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage.jsx'));
const TenantMessageDetailPage = lazy(() => import('./pages/tenants/TenantMessageDetailPage.jsx'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage.jsx'));
const AuditLogsPage = lazy(() => import('./pages/audit/AuditLogsPage.jsx'));
const ReferralsPage = lazy(() => import('./pages/referrals/ReferralsPage.jsx'));
const ChatPage = lazy(() => import('./pages/chat/ChatPage.jsx'));
const PlatformAdminSupportPage = lazy(() => import('./pages/platformAdmin/PlatformAdminSupportPage.jsx'));
const AgentsPage = lazy(() => import('./pages/agents/AgentsPage.jsx'));
const PlatformAdminMaintenancePage = lazy(() => import('./pages/platformAdmin/PlatformAdminMaintenancePage.jsx'));
const NetworkPage = lazy(() => import('./pages/network/NetworkPage.jsx'));
const LandsListPage = lazy(() => import('./pages/lands/LandsListPage.jsx'));
const LandDetailPage = lazy(() => import('./pages/lands/LandDetailPage.jsx'));
const DealsPage = lazy(() => import('./pages/deals/DealsPage.jsx'));
const MyRentalsPage = lazy(() => import('./pages/tenants/MyRentalsPage.jsx'));
const PlatformAdminOverviewPage = lazy(() => import('./pages/platformAdmin/PlatformAdminOverviewPage.jsx'));
const PlatformAdminOrganizationsPage = lazy(() => import('./pages/platformAdmin/PlatformAdminOrganizationsPage.jsx'));
const PlatformAdminAdministratorsPage = lazy(() => import('./pages/platformAdmin/PlatformAdminAdministratorsPage.jsx'));
const PlatformAdminBackupsPage = lazy(() => import('./pages/platformAdmin/PlatformAdminBackupsPage.jsx'));
const PlatformAdminAuditLogPage = lazy(() => import('./pages/platformAdmin/PlatformAdminAuditLogPage.jsx'));
const PlatformAdminAccountPage = lazy(() => import('./pages/platformAdmin/PlatformAdminAccountPage.jsx'));

export default function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
        <PlatformAdminProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            {/* Every tenant's own branded auth flow, namespaced by their
                URL name (see contexts/BrandingContext.jsx and
                layouts/AuthLayout.jsx, which fetches and applies this
                organization's branding for everything nested here). */}
            <Route path="/:orgSlug/login" element={<LoginPage />} />
            <Route path="/:orgSlug/register" element={<RegisterPage />} />
            <Route path="/:orgSlug/rent" element={<RentPage />} />
            <Route path="/:orgSlug/check-email" element={<CheckEmailPage />} />
            <Route path="/:orgSlug/verify-email" element={<VerifyEmailPage />} />
            <Route path="/:orgSlug/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/:orgSlug/reset-password" element={<ResetPasswordPage />} />
            <Route path="/:orgSlug/set-password" element={<ResetPasswordPage />} />

            {['login', 'register', 'check-email', 'verify-email', 'forgot-password', 'reset-password', 'set-password'].map((path) => (
              <Route key={path} path={`/${path}`} element={<BareAuthRedirect />} />
            ))}

            {/* Platform console — creates/activates/deactivates tenant
                organizations. Entirely separate auth from the tenant flows
                above (see contexts/PlatformAdminContext.jsx). */}
            <Route path="/platform-admin/login" element={<PlatformAdminLoginPage />} />
            <Route path="/platform-admin/forgot-password" element={<PlatformAdminForgotPasswordPage />} />
            <Route path="/platform-admin/reset-password" element={<PlatformAdminResetPasswordPage />} />
            <Route element={<PlatformAdminProtectedRoute />}>
              <Route element={<PlatformAdminLayout />}>
                <Route path="/platform-admin" element={<Suspense fallback={<LoadingState />}><PlatformAdminOverviewPage /></Suspense>} />
                <Route path="/platform-admin/organizations" element={<Suspense fallback={<LoadingState />}><PlatformAdminOrganizationsPage /></Suspense>} />
                <Route path="/platform-admin/administrators" element={<Suspense fallback={<LoadingState />}><PlatformAdminAdministratorsPage /></Suspense>} />
                <Route path="/platform-admin/support" element={<Suspense fallback={<LoadingState />}><PlatformAdminSupportPage /></Suspense>} />
                <Route path="/platform-admin/maintenance" element={<Suspense fallback={<LoadingState />}><PlatformAdminMaintenancePage /></Suspense>} />
                <Route path="/platform-admin/backups" element={<Suspense fallback={<LoadingState />}><PlatformAdminBackupsPage /></Suspense>} />
                <Route path="/platform-admin/audit-log" element={<Suspense fallback={<LoadingState />}><PlatformAdminAuditLogPage /></Suspense>} />
                <Route path="/platform-admin/account" element={<Suspense fallback={<LoadingState />}><PlatformAdminAccountPage /></Suspense>} />
              </Route>
            </Route>

            {/* The authenticated dashboard itself carries no org slug in
                its URLs — the session already knows which organization,
                and BrandingProvider fetches that organization's branding
                automatically once signed in (see
                api/organizations.js#getMyBranding). */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/home" element={<Suspense fallback={<LoadingState />}><HomePage /></Suspense>} />
                <Route path="/dashboard" element={<Suspense fallback={<LoadingState />}><DashboardPage /></Suspense>} />
                <Route path="/properties" element={<Suspense fallback={<LoadingState />}><PropertiesListPage /></Suspense>} />
                <Route path="/properties/:id" element={<Suspense fallback={<LoadingState />}><PropertyDetailPage /></Suspense>} />
                <Route path="/chat" element={<Suspense fallback={<LoadingState />}><ChatPage /></Suspense>} />
                <Route path="/lands" element={<Suspense fallback={<LoadingState />}><LandsListPage /></Suspense>} />
                <Route path="/lands/:id" element={<Suspense fallback={<LoadingState />}><LandDetailPage /></Suspense>} />
                <Route path="/deals" element={<Suspense fallback={<LoadingState />}><DealsPage /></Suspense>} />
                <Route path="/my-deals" element={<Suspense fallback={<LoadingState />}><DealsPage mine /></Suspense>} />
                <Route path="/network" element={<Suspense fallback={<LoadingState />}><NetworkPage /></Suspense>} />
                <Route path="/agents" element={<Suspense fallback={<LoadingState />}><AgentsPage /></Suspense>} />
                <Route path="/my-rentals" element={<Suspense fallback={<LoadingState />}><MyRentalsPage /></Suspense>} />
                <Route path="/tenants" element={<Suspense fallback={<LoadingState />}><TenantsListPage /></Suspense>} />
                <Route path="/message-manager" element={<Suspense fallback={<LoadingState />}><MessageManagerPage /></Suspense>} />
                <Route path="/tenant-messages/:id" element={<Suspense fallback={<LoadingState />}><TenantMessageDetailPage /></Suspense>} />
                <Route path="/message-manager/:id" element={<Suspense fallback={<LoadingState />}><TenantMessageDetailPage /></Suspense>} />
                <Route path="/tenant-messages" element={<Suspense fallback={<LoadingState />}><TenantMessagesInboxPage /></Suspense>} />
                <Route path="/owners" element={<Suspense fallback={<LoadingState />}><OwnersListPage /></Suspense>} />
                <Route path="/leases" element={<Suspense fallback={<LoadingState />}><LeasesListPage /></Suspense>} />
                <Route path="/my-lease" element={<Suspense fallback={<LoadingState />}><MyLeasePage /></Suspense>} />
                <Route path="/invoices" element={<Suspense fallback={<LoadingState />}><InvoicesListPage /></Suspense>} />
                <Route path="/payments" element={<Suspense fallback={<LoadingState />}><PaymentsListPage /></Suspense>} />
                <Route path="/expenses" element={<Suspense fallback={<LoadingState />}><ExpensesListPage /></Suspense>} />
                <Route path="/my-payments" element={<Suspense fallback={<LoadingState />}><MyPaymentsPage /></Suspense>} />
                <Route path="/maintenance" element={<Suspense fallback={<LoadingState />}><MaintenanceRequestsListPage /></Suspense>} />
                <Route path="/maintenance/:id" element={<Suspense fallback={<LoadingState />}><MaintenanceRequestDetailPage /></Suspense>} />
                <Route path="/work-orders" element={<Suspense fallback={<LoadingState />}><WorkOrdersListPage /></Suspense>} />
                <Route path="/vendors" element={<Suspense fallback={<LoadingState />}><VendorsListPage /></Suspense>} />
                <Route path="/inspections" element={<Suspense fallback={<LoadingState />}><InspectionsListPage /></Suspense>} />
                <Route path="/inspections/:id" element={<Suspense fallback={<LoadingState />}><InspectionDetailPage /></Suspense>} />
                <Route path="/users" element={<Suspense fallback={<LoadingState />}><UsersRolesPage /></Suspense>} />
                <Route path="/roles/:id" element={<Suspense fallback={<LoadingState />}><RoleDetailPage /></Suspense>} />
                <Route path="/settings" element={<Suspense fallback={<LoadingState />}><SettingsPage /></Suspense>} />
                <Route path="/reports/financial" element={<Suspense fallback={<LoadingState />}><ReportsPage /></Suspense>} />
                <Route path="/notifications" element={<Suspense fallback={<LoadingState />}><NotificationsPage /></Suspense>} />
                <Route path="/audit-logs" element={<Suspense fallback={<LoadingState />}><AuditLogsPage /></Suspense>} />
                <Route path="/referrals" element={<Suspense fallback={<LoadingState />}><ReferralsPage /></Suspense>} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PlatformAdminProvider>
      </BrandingProvider>
    </AuthProvider>
  );
}
