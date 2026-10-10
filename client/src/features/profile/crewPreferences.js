import { SPORTS, LEVELS } from '../crews/crews.js';

export function preferenceInput(form, regions) {
  if (!Array.isArray(form.interested_sports) || form.interested_sports.some(sport => !Object.hasOwn(SPORTS, sport))) throw new Error('관심 운동을 다시 선택해 주세요.');
  if (form.level && !Object.hasOwn(LEVELS, form.level)) throw new Error('레벨을 다시 선택해 주세요.');
  const hasRegion = Boolean(form.region_sido || form.region_sigungu);
  if (hasRegion && !regions.some(row => row.sido === form.region_sido && row.sigungu === form.region_sigungu))
    throw new Error('시/도와 시/군/구를 함께 선택해 주세요.');
  if (!Array.isArray(form.preferred_days) || form.preferred_days.some(day => !Number.isInteger(day) || day < 0 || day > 6))
    throw new Error('활동 요일을 다시 선택해 주세요.');
  return {
    profile: { level: form.level || null },
    settings: { interested_sports: [...new Set(form.interested_sports)], region_sido: form.region_sido || null, region_sigungu: form.region_sigungu || null,
      preferred_days: [...new Set(form.preferred_days)].sort((a, b) => a - b) },
  };
}

export async function saveCrewPreferences(db, userId, form, regions) {
  if (!userId) throw new Error('로그인이 필요해요.');
  const {profile, settings} = preferenceInput(form, regions);
  const p = await db.from('profiles').update(profile).eq('id', userId).select('id').single();
  if (p.error || !p.data) throw new Error('운동 레벨을 저장하지 못했어요. 입력을 유지했으니 다시 시도해 주세요.');
  try {
    const s = await db.from('user_settings').update(settings).eq('user_id', userId).select('user_id').single();
    if (s.error || !s.data) throw new Error();
  } catch {
    throw new Error('운동 레벨은 저장됐지만 관심 운동·지역·요일 저장을 확인하지 못했어요. 입력을 유지했으니 다시 저장해 주세요.');
  }
}

