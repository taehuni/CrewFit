// Read only the related ID; list views do not need precise GPS coordinates.
export function recordSource(activity) {
  const route = activity.activity_routes;
  return (Array.isArray(route) ? route.some(row => row?.activity_id != null) : route?.activity_id != null)
    ? 'GPS 측정' : '직접 입력';
}
