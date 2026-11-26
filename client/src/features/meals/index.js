import { lazy } from 'react';
export { loadMealPlanRecords } from './mealPlanRecords.js';
export const MealsPage = lazy(() => import('./MealsPage.jsx'));
export const MealCreatePage = lazy(() => import('./MealCreatePage.jsx'));
export const MealDetailPage = lazy(() => import('./MealDetailPage.jsx'));
export const MealEditPage = lazy(() => import('./MealEditPage.jsx'));
