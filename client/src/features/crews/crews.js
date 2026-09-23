export const SPORTS = { running: '러닝', walking: '걷기', cycling: '자전거', swimming: '수영', gym: '헬스', other: '기타' };
export const LEVELS = { beginner: '입문', intermediate: '중급', advanced: '상급' };
export const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
export const CREW_FIELDS = 'id,owner_id,name,description,sport,level,region_sido,region_sigungu,activity_days,join_mode,created_at';
export function dayLabel(days = []) { return days.length ? days.map(day => DAYS[day]).join(' · ') : '요일 협의'; }
export function validCrewId(id) { return typeof id === 'string' && /^[1-9]\d*$/.test(id) && BigInt(id) <= 9223372036854775807n; }

export function crewInput(form, regions) {
  const name = form.name?.trim() || '', description = form.description?.trim() || '';
  if (name.length < 2 || name.length > 40) throw new Error('크루 이름은 2~40자로 입력해 주세요.');
  if (description.length > 1000) throw new Error('소개는 1,000자 이내로 입력해 주세요.');
  if (!Object.hasOwn(SPORTS, form.sport)) throw new Error('종목을 선택해 주세요.');
  if (form.level && !Object.hasOwn(LEVELS, form.level)) throw new Error('올바른 레벨을 선택해 주세요.');
  if (!['open','approval'].includes(form.join_mode)) throw new Error('가입 방식을 선택해 주세요.');
  if (!regions.some(row => row.sido === form.region_sido && row.sigungu === form.region_sigungu)) throw new Error('활동 지역을 선택해 주세요.');
  if (!Array.isArray(form.activity_days) || form.activity_days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('요일을 다시 선택해 주세요.');
  return { name, description: description || null, sport: form.sport, level: form.level || null,
    join_mode: form.join_mode, region_sido: form.region_sido, region_sigungu: form.region_sigungu,
    activity_days: [...new Set(form.activity_days)].sort((a,b)=>a-b) };
}

export async function loadRegions(db) {
  const rows = [];
  for (;;) {
    const { data, error } = await db.from('regions').select('sido,sigungu').order('sido').order('sigungu').range(rows.length, rows.length + 199);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('지역 목록을 불러오지 못했어요.');
    if (!data.length) return rows;
    rows.push(...data);
  }
}

export async function loadCrews(db, sport = '', cursor = null) {
  if (sport && !Object.hasOwn(SPORTS, sport)) throw new Error('올바른 종목을 선택해 주세요.');
  let query = db.from('crews').select(CREW_FIELDS).order('id', { ascending: false }).limit(20);
  if (sport) query = query.eq('sport', sport);
  if (cursor != null) query = query.lt('id', cursor);
  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('크루 목록을 불러오지 못했어요.');
  return { rows: data, nextCursor: data.length ? data.at(-1).id : undefined };
}

export async function createCrew(db, userId, form, regions) {
  if (!userId) throw new Error('로그인이 필요해요.');
  const row = crewInput(form, regions);
  const { data, error } = await db.from('crews').insert({ ...row, owner_id: userId }).select(CREW_FIELDS).single();
  if (error) throw new Error('크루 생성 결과를 확인하지 못했어요. 목록을 확인한 뒤 다시 시도해 주세요.');
  if (!data?.id) throw new Error('크루 생성 결과가 없어요. 목록을 확인해 주세요.');
  return data;
}

export async function loadCrew(db, id, userId) {
  if (!validCrewId(id)) return null;
  const { data, error } = await db.from('crews').select(CREW_FIELDS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [count, owner, member] = await Promise.all([
    db.rpc('crew_member_count', { p_crew_id: id }),
    db.from('profiles').select('nickname').eq('id', data.owner_id).maybeSingle(),
    db.from('crew_members').select('status').eq('crew_id', id).eq('user_id', userId).maybeSingle(),
  ]);
  if (count.error || owner.error || member.error) throw new Error('크루 상세 정보를 불러오지 못했어요.');
  return { ...data, member_count: count.data, owner_nickname: owner.data?.nickname || '크루장', membership: member.data?.status || null };
}
