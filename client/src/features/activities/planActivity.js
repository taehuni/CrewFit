import { ACTIVITY_SPORTS } from './sports.js';

// Navigation state is only a suggested draft, never proof of a completed workout.
export function planActivityDraft(state, userId) {
  if (!userId || state?.planOwnerId !== userId) return null;
  const plan = state?.workoutPlan;
  if (!plan || !ACTIVITY_SPORTS.includes(plan.sport)
    || typeof plan.scheduled_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(plan.scheduled_on)
    || plan.scheduled_on < '2000-01-01' || plan.scheduled_on > '2100-12-31'
    || !Number.isInteger(plan.minutes) || plan.minutes < 5 || plan.minutes > 240
    || typeof plan.title !== 'string' || !plan.title.trim() || plan.title.length > 100
    || (plan.note != null && (typeof plan.note !== 'string' || plan.note.length > 1000))) return null;
  const date = new Date(plan.scheduled_on + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== plan.scheduled_on) return null;
  return {
    title: plan.title,
    note: plan.note || '',
    returnTo: '/coach?view=plans&date=' + plan.scheduled_on,
    values: {
      sport: plan.sport, date: plan.scheduled_on, minutes: String(plan.minutes), seconds: '0',
      distance: '', lapCount: '', note: '', sets: [{ name: '', reps: '', weight: '' }],
    },
  };
}
