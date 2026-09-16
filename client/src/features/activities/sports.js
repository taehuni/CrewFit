export const ACTIVITY_SPORTS = ['running', 'walking', 'cycling', 'swimming', 'gym', 'other'];
export const hasDistance = sport => ['running', 'walking', 'cycling', 'swimming'].includes(sport);
export const distanceUnit = sport => sport === 'swimming' ? 'm' : 'km';
export const distanceFactor = sport => sport === 'swimming' ? 1 : 1000;
export const initialActivitySport = sport => ACTIVITY_SPORTS.includes(sport) ? sport : 'running';
