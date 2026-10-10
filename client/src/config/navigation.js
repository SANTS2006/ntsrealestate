import {
  Home, LayoutDashboard, Briefcase, MessagesSquare, Building2, Users, UserCircle, FileText, Wallet, Wrench, Bell, ShieldCheck, History, Settings, MessageSquare, Gift, Network, LandPlot, Handshake,
} from 'lucide-react';

import { hasPermission } from './capabilities.js';

// Permission-aware navigation (§77 of the requirements): `roles` narrows
// which roles see a nav item at all. This is a UX convenience ONLY —
// hiding a link here is never the security boundary; every route it points
// to is independently authorized server-side regardless of what's shown
// here. `undefined` roles means "visible to every authenticated user."
export const NAV_SECTIONS = [
  { label: 'Home', icon: Home, to: '/home' },
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  {
    label: 'Properties', icon: Building2, to: '/properties', permission: 'properties:read',
    roles: ['administrator', 'agent', 'owner', 'accountant', 'maintenance_manager', 'auditor'],
  },
  // owner now included — owner.service.js/tenant.service.js scope the list
  // to tenants/owners tied to their own properties (see
  // docs/security/authorization.md).
  { label: 'Tenants', icon: Users, to: '/tenants', permission: 'tenants:read', roles: ['administrator', 'agent', 'owner', 'accountant', 'auditor'] },
  { label: 'Owners', icon: UserCircle, to: '/owners', permission: 'owners:read', roles: ['administrator', 'agent', 'accountant', 'auditor'] },
  { label: 'Lands', icon: LandPlot, to: '/lands', permission: 'lands:read', roles: ['administrator', 'agent', 'owner', 'accountant', 'auditor'] },
  { label: 'Sales & Leases', icon: Handshake, to: '/deals', permission: 'deals:read', roles: ['administrator', 'agent', 'owner', 'accountant', 'auditor'] },
  { label: 'Leases', icon: FileText, to: '/leases', permission: 'leases:read', roles: ['administrator', 'agent', 'owner', 'accountant', 'auditor'] },
  { label: 'Network', icon: Network, to: '/network', roles: ['administrator'] },
  { label: 'Agents', icon: Briefcase, to: '/agents', permission: 'agents:read', roles: ['administrator', 'owner', 'agent'] },
  { label: 'My Properties', icon: Home, to: '/my-rentals', permission: 'rentals:read', roles: ['tenant'] },
  { label: 'My Lease', icon: FileText, to: '/my-lease', roles: ['tenant'] },
  { label: 'My Deals', icon: Handshake, to: '/my-deals', permission: 'deals:read', roles: ['tenant'] },
  {
    label: 'Finance', icon: Wallet,
    roles: ['administrator', 'accountant', 'agent', 'owner', 'auditor'],
    children: [
      { label: 'Invoices', to: '/invoices', permission: 'invoices:read' },
      { label: 'Payments', to: '/payments', permission: 'payments:read' },
      { label: 'Expenses', to: '/expenses', permission: 'expenses:read' },
      { label: 'Financial Reports', to: '/reports/financial', permission: 'reports:read' },
    ],
  },
  { label: 'My Payments', icon: Wallet, to: '/my-payments', roles: ['tenant'] },
  {
    label: 'Maintenance', icon: Wrench,
    roles: ['administrator', 'agent', 'owner', 'maintenance_manager', 'auditor'],
    children: [
      { label: 'Requests', to: '/maintenance', permission: 'maintenance:read' },
      { label: 'Work Orders', to: '/work-orders', permission: 'work-orders:read' },
      { label: 'Vendors', to: '/vendors', permission: 'vendors:read' },
      { label: 'Inspections', to: '/inspections', permission: 'inspections:read' },
    ],
  },
  { label: 'Maintenance', icon: Wrench, to: '/maintenance', roles: ['tenant'] },
  { label: 'Message Manager', icon: MessageSquare, to: '/message-manager', permission: 'tenant-messages:create', roles: ['tenant'] },
  { label: 'Tenant Messages', icon: MessageSquare, to: '/tenant-messages', permission: 'tenant-messages:read', roles: ['administrator', 'agent', 'owner', 'maintenance_manager'] },
  { label: 'Referrals', icon: Gift, to: '/referrals', permission: 'referrals:read', roles: ['administrator', 'accountant', 'auditor', 'tenant', 'owner', 'agent'] },
  { label: 'Chat', icon: MessagesSquare, to: '/chat', roles: ['tenant', 'owner', 'agent', 'administrator'] },
  { label: 'Notifications', icon: Bell, to: '/notifications' },
  { label: 'Users & Roles', icon: ShieldCheck, to: '/users', permission: 'users:read', roles: ['administrator', 'auditor'] },
  { label: 'Audit Logs', icon: History, to: '/audit-logs', permission: 'audit-logs:read', roles: ['administrator', 'auditor'] },
  // No `roles` restriction — every authenticated user gets an Account tab
  // (change password, MFA); the Organization tab self-gates inside the page.
  { label: 'Settings', icon: Settings, to: '/settings' },
];

// An entry shows when the person has one of its roles (if it names any) AND
// the permission it needs (if it names one). A group shows only if at least
// one of its entries does.
export function isNavItemVisible(item, roles) {
  if (item.roles && !item.roles.some((r) => roles.includes(r))) return false;
  if (item.children) return visibleChildren(item, roles).length > 0;
  return !item.permission || hasPermission(item.permission);
}

export function visibleChildren(item, roles) {
  return item.children.filter((child) => isNavItemVisible(child, roles));
}
