# Authentication

AI Acquisitions OS uses Supabase Auth as the production authentication provider.

## Current Scope

PR-1 adds the client authentication foundation:

- Email and password sign in
- Secure sign out through Supabase Auth
- Browser session persistence
- Token auto-refresh through the Supabase client
- Session validation during application bootstrap
- Expired-session detection with refresh fallback
- Password reset email request foundation
- Protected application shell
- React authentication context and reusable hooks

The existing CRM surface is available only after a valid Supabase session is present.

## Auth Boundary

The app is wrapped in `AuthProvider` and `ProtectedRoute` from `src/main.jsx`.

`AuthProvider` owns:

- Initial session lookup
- Auth state subscriptions
- Session refresh calls
- Current user state
- Current role and permission helper state
- Sign in, sign out, and password reset actions

`ProtectedRoute` owns:

- Loading state while the session is being checked
- Unauthorized state for missing or expired sessions
- Rendering the sign-in screen before the main product shell

## Services

Auth logic lives under `src/services/auth/`.

- `authService.js`: low-level Supabase Auth calls
- `sessionService.js`: session validation, refresh, and subscription helpers
- `authorizationService.js`: reusable role and permission helpers
- `authGuardService.js`: route/session guard helpers
- `index.js`: public auth service exports

Components should use hooks instead of calling Supabase Auth directly.

## Hooks

- `useAuth()`: full auth state and auth actions
- `useSession()`: session-focused state and refresh action
- `usePermissions()`: role and permission helper access

## Password Reset

Password reset is currently a foundation flow. The sign-in screen can request a Supabase password reset email and redirects back to the app origin.

PR-2 should add a dedicated password update route or screen for users returning from Supabase recovery links.

## Security Notes

- The browser uses the Supabase anon key only.
- Service-role keys must never be exposed to client code.
- Supabase client auth is configured with persistent sessions, URL session detection, and token auto-refresh.
- Logout calls Supabase Auth sign-out so refresh tokens are revoked according to the project Auth settings.
- Client-side guards improve UX, but database Row Level Security and server-side token verification are still required before multi-tenant enforcement.

## Remaining Work

- Add server-side JWT validation for Netlify Functions.
- Add database RLS policies tied to Supabase Auth users.
- Add password recovery completion UI.
- Replace local SaaS placeholder user context with authenticated organization membership records.
- Add auth integration tests around sign-in, sign-out, session refresh, and recovery flows.
