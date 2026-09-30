import { goalRanges } from './goalProgress.js';

const failure = (status, code, message) => Object.assign(new Error(message), { status, code });

// D-15/D-20: admin reads are confined to this service. Never return raw rows or member IDs.
export async function loadCrewStats(db, userId, crewId, period = 'week', options = {}) {
  if (!userId) throw failure(401, 'UNAUTHORIZED', '로그인이 필요해요.');
  if (typeof crewId !== 'string' || !/^[1-9]\d*$/.test(crewId) || BigInt(crewId) > 9223372036854775807n)
    throw failure(400, 'INVALID_CREW', '올바른 크루 주소가 아니에요.');
  if (!['week', 'month'].includes(period)) throw failure(400, 'INVALID_PERIOD', '주간 또는 월간을 선택해 주세요.');
  const crew = await db.from('crews').select('id').eq('id', crewId).maybeSingle();
  if (crew.error) throw failure(500, 'STATS_FAILED', '크루 정보를 확인하지 못했어요.');
  if (!crew.data) throw failure(404, 'CREW_NOT_FOUND', '크루를 찾을 수 없어요.');
  let admin = options.admin;
  if (!admin) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) throw failure(503, 'CONFIG_REQUIRED', '크루 통계 서버 설정이 필요해요.');
    admin = (await import('../config/supabase.js')).supabaseAdmin;
  }
  const range = goalRanges(options.now)[period];
  const totals = { distance_m: 0, duration_sec: 0, activity_count: 0 };
  const contributors = new Set();
  let cursor = null;
  for (;;) {
    // Inner joins filter the activity owner and CURRENT approved membership in the same query.
    // Select no names, notes, locations, routes, or private settings.
    let query = admin.from('activities')
      .select('id,user_id,distance_m,duration_sec,profiles!inner(activity_visibility,crew_members!inner(crew_id,status))')
      .in('profiles.activity_visibility', ['public', 'crew'])
      .eq('profiles.crew_members.crew_id', crewId).eq('profiles.crew_members.status', 'approved')
      .gte('performed_on', range.from).lte('performed_on', range.to)
      .order('id', { ascending: true }).limit(500);
    if (cursor !== null) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error || !Array.isArray(data)) throw failure(500, 'STATS_FAILED', '크루 통계를 불러오지 못했어요. 다시 시도해 주세요.');
    if (!data.length) break;
    const next = data.at(-1).id;
    if (cursor !== null && BigInt(next) <= BigInt(cursor)) throw failure(500, 'STATS_FAILED', '크루 통계를 불러오지 못했어요.');
    for (const row of data) {
      // Fail closed even if a malformed join response reaches the service.
      if (!row.user_id || !['public', 'crew'].includes(row.profiles?.activity_visibility)
        || !row.profiles.crew_members?.some(member => String(member.crew_id) === crewId && member.status === 'approved')) continue;
      contributors.add(row.user_id);
      totals.activity_count++;
      totals.distance_m += row.distance_m ?? 0;
      totals.duration_sec += row.duration_sec;
    }
    cursor = next;
  }
  if (contributors.size < 3) return { hidden: true, reason: 'MIN_MEMBERS' };
  return { period, period_start: range.from, period_end: range.to, ...totals, contributing_members: contributors.size };
}
