import { lazy } from 'react';
export const TrackingPage = lazy(() => import('./TrackingPage.jsx'));
export const SavedRoute = lazy(() => import('./SavedRoute.jsx'));
export const GpsDraftList = lazy(() => import('./GpsDraftList.jsx'));
export const GpsRouteMap = lazy(() => import('./RouteMap.jsx'));
export { loadGpsDraft, finalizeGpsDraft } from './drafts.js';
export { loadOwnRoute } from './routes.js';
export { TRACKING_SPORTS } from './tracking.js';
