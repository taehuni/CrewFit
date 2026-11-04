export function calendarPlanAccess(plan,exports,hasToken){
 const saved=exports?.find(row=>row.plan_id===plan.id);
 return saved?{mode:'saved',saved}:hasToken?{mode:'add'}:{mode:'connect'};
}
