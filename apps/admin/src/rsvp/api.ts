/**
 * Public surface of the RSVP events domain (local fork feature), consumed by
 * the admin shell (apps/admin/src/routes.tsx). Everything else is internal.
 */

// Lazy entries, not component re-exports: the shell mounts these behind
// `lazy:`/`lazy()`, so static re-exports would pull the chunks into the
// shell bundle.
export const lazyRsvpEventsScreen = () => import('./events');
export const lazyRsvpEventDetailScreen = () => import('./event-detail');
