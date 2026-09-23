import { lazy } from 'react';
export { ACTIVITY_SPORTS, distanceFactor, distanceUnit } from './sports.js';
export const ActivitiesPage = lazy(() => import('./ActivitiesPage.jsx'));
export const ExerciseNamesPage = lazy(() => import('./ExerciseNamesPage.jsx'));
export const ActivityCreatePage = lazy(() => import('./ActivityCreatePage.jsx'));
export const ActivityDetailPage = lazy(() => import('./ActivityDetailPage.jsx'));
export const ActivityEditPage = lazy(() => import('./ActivityEditPage.jsx'));
