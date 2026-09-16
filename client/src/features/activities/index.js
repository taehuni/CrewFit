import { lazy } from 'react';
export { ACTIVITY_SPORTS, distanceFactor, distanceUnit } from './sports.js';
export const ActivitiesPage = lazy(() => import('./ActivitiesPage.jsx'));
export const ExerciseNamesPage = lazy(() => import('./ExerciseNamesPage.jsx'));
export { default as ActivityCreatePage } from './ActivityCreatePage.jsx';
export { default as ActivityDetailPage } from './ActivityDetailPage.jsx';
export { default as ActivityEditPage } from './ActivityEditPage.jsx';
