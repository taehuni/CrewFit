const fields = 'id,name,sport,level,region_sido,region_sigungu,activity_days,join_mode';
const failure = (status, code, message) => Object.assign(new Error(message), { status, code });
function checked(result) {
  if (result.error) throw failure(500, 'MATCH_FAILED', '추천 크루를 불러오지 못했어요. 다시 시도해 주세요.');
  return result.data;
}

export function matchCriteria(profile, settings) {
  return [
    ...(settings?.region_sido && settings?.region_sigungu ? ['region'] : []),
    ...(settings?.preferred_days?.length ? ['days'] : []),
    ...(profile.level ? ['level'] : []),
  ];
}

export function matchedOn(crew, profile, settings) {
  return [...((settings?.interested_sports ?? (profile.main_sport ? [profile.main_sport] : [])).includes(crew.sport) ? ['sport'] : []),
    ...(crew.region_sido === settings?.region_sido && crew.region_sigungu === settings?.region_sigungu ? ['region'] : []),
    ...(crew.activity_days?.some(day => settings?.preferred_days?.includes(day)) ? ['days'] : []),
    ...(profile.level && crew.level === profile.level ? ['level'] : []),
  ];
}

export async function matchCrews(db, userId) {
  if (!userId) throw failure(401, 'UNAUTHORIZED', '로그인이 필요해요.');
  const [p, s] = await Promise.all([
    db.from('profiles').select('main_sport,level').eq('id', userId).maybeSingle(),
    db.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
  ]);
  const profile = checked(p), settings = checked(s);
  if (!profile) throw failure(400, 'SETTINGS_REQUIRED', '프로필을 먼저 확인해 주세요.');
  const interests = settings?.interested_sports ?? (profile.main_sport ? [profile.main_sport] : []);
  const excluded = new Set();
  // Paginate own memberships so pending and approved crews are both excluded beyond the API row cap.
  for (let offset = 0; ; offset += 100) {
    const rows = checked(await db.from('crew_members').select('crew_id').eq('user_id', userId)
      .order('crew_id').range(offset, offset + 99)) || [];
    rows.forEach(row => excluded.add(String(row.crew_id)));
    if (rows.length < 100) break;
  }
  const active = matchCriteria(profile, settings), relaxed = [];
  for (;;) {
    const matches = [];
    for (let offset = 0; matches.length < 20; offset += 100) {
      let query = db.from('crews').select(fields).neq('owner_id', userId);
      if (interests.length) query = query.in('sport', interests);
      if (active.includes('region')) query = query.eq('region_sido', settings.region_sido).eq('region_sigungu', settings.region_sigungu);
      if (active.includes('days')) query = query.overlaps('activity_days', settings.preferred_days);
      if (active.includes('level')) query = query.eq('level', profile.level);
      const rows = checked(await query.order('id', { ascending: false }).range(offset, offset + 99)) || [];
      matches.push(...rows.filter(row => !excluded.has(String(row.id))).slice(0, 20 - matches.length));
      if (rows.length < 100) break;
    }
    if (matches.length || !active.length) {
      const crews = await Promise.all(matches.map(async crew => ({ ...crew,
        member_count: checked(await db.rpc('crew_member_count', { p_crew_id: crew.id })),
        matched_on: matchedOn(crew, profile, settings),
      })));
      return { crews, relaxed };
    }
    relaxed.push(active.pop());
  }
}

