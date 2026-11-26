export function proposalSavedDate(turnId, plans) {
  return plans.filter(plan => plan.turn_id === turnId && /^\d{4}-\d{2}-\d{2}$/.test(plan.scheduled_on))
    .map(plan => plan.scheduled_on).sort()[0] || null;
}
