# Frontend Architecture

## Layout (`client/src`)

```
api/            — axios instance (client.js) + one file per resource's API calls (Phase 7+)
assets/         — static images/icons bundled by Vite
components/
  ui/           — design-system primitives (Button, Input, Modal, Table, ... — §76)
  layout/       — Sidebar, Topbar, AppShell (Phase 4+, permission-aware nav per §77)
  common/       — cross-page composites (StatCard, EmptyState, ConfirmDialog, ...)
config/         — env.js (public config only — see client/.env.example)
contexts/       — ThemeContext (done); AuthContext, OrganizationContext (Phase 4)
hooks/          — useDebounce, usePagination, usePermission, ... (added as needed)
layouts/        — route-level layout wrappers (AuthLayout, DashboardLayout)
pages/          — one file/folder per route
routes/         — route table + ProtectedRoute/PermissionRoute guards (Phase 4+)
services/       — thin wrappers composing api/ calls with client-side caching where used
utils/          — formatting (currency, dates), generic helpers
validations/    — Zod schemas mirroring server validators, used by react-hook-form
```

## State management policy

- **Server state** (anything fetched from the API) is owned by the component/hook that
  fetches it — no global cache duplication for Phase 1–3. If list/detail data needs to be
  shared across distant routes without prop drilling, that's a `zustand` store candidate,
  introduced only when a concrete case demonstrates the need (per the "Zustand only where
  genuinely required" mandate) — not by default.
- **Auth/session state** (current user, organization, roles/permissions) lives in
  `AuthContext` (Context API — accessed everywhere, changes rarely, exactly what Context is
  for).
- **UI-local state** (open/closed modal, active tab, form values) stays in the component via
  `useState`/`react-hook-form`.

## Security posture (frontend)

- `api/client.js` is the only place that talks to the backend; it always sets
  `withCredentials: true` and echoes the CSRF cookie on state-changing requests — no other
  code should construct its own `fetch`/`axios` call.
- No JWT, session id, or credential is ever written to `localStorage`/`sessionStorage`.
  `ThemeContext` is the only thing using `localStorage`, and it stores a UI preference, not
  a secret.
- Route guarding (`ProtectedRoute`/permission checks) is a UX convenience only — see
  authorization.md: hiding a nav item or route is never treated as a real security boundary
  by the backend, and the frontend must not assume otherwise either.
- Every list/detail page is built against loading/empty/error/unauthorized/forbidden states
  from day one (§74 of the requirements) rather than retrofitted later.

## Design system

Tailwind CSS with a small `brand` color scale (see `tailwind.config.js`); `class`-based dark
mode driven by `ThemeContext`, which supports light/dark/system and persists the choice.
Reusable primitives (§76 of the requirements) are added to `components/ui/` incrementally as
each module needs them, rather than speculatively built ahead of use.
