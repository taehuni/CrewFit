// Change this version whenever recipients, purpose, cadence or retention change.
export const POSE_CONSENT_VERSION = '2026-11-21';
export const POSE_CONSENT_SCOPES = ['recognition', 'observation'];
export function poseConsentChoice(records, scope) {
  if (!POSE_CONSENT_SCOPES.includes(scope) || !Array.isArray(records)) return 'not-granted';
  const record = records.find(item => item?.scope === scope && item.version === POSE_CONSENT_VERSION && Boolean(item.accepted_at));
  return !record ? 'not-granted' : record.revoked_at ? 'revoked' : 'accepted';
}
export function hasPoseConsent(records, scope) {
  return poseConsentChoice(records, scope) === 'accepted';
}
