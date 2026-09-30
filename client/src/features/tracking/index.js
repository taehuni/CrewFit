import { lazy } from 'react';
export const TrackingPage = lazy(() => import('./TrackingPage.jsx'));
export const SavedRoute = lazy(() => import('./SavedRoute.jsx'));
export { loadOwnRoute } from './routes.js';
export { TRACKING_SPORTS } from './tracking.js';
