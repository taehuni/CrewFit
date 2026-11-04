export function coachRouteState(search, today, initialView = 'conversation') {
  const candidate = search.get('date') || '';
  const parsed = new Date(candidate + 'T00:00:00Z');
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(candidate) &&
    Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate &&
    candidate >= '2000-01-01' && candidate <= '2100-12-31';
  const mode = search.get('view');
  return { view: mode === 'plans' ? 'plans' : mode === 'chat' ? 'conversation' : initialView,
    date: valid ? candidate : today };
}
