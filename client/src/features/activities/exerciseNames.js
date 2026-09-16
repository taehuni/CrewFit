import { validActivityId } from './activityDetail.js';

export const EXERCISE_SEEDS = [
  '스쿼트', '벤치프레스', '데드리프트', '오버헤드 프레스', '바벨 로우',
  '풀업', '랫풀다운', '시티드 로우', '레그 프레스', '레그 익스텐션',
  '레그 컬', '런지', '불가리안 스플릿 스쿼트', '힙 쓰러스트', '카프 레이즈',
  '인클라인 벤치프레스', '덤벨 프레스', '덤벨 플라이', '체스트 프레스', '푸시업',
  '딥스', '사이드 레터럴 레이즈', '페이스 풀', '리어 델트 플라이', '바벨 컬',
  '덤벨 컬', '해머 컬', '트라이셉스 푸시다운', '플랭크', '크런치',
];
const nameKey = value => value.trim().toLowerCase();
export function exerciseSuggestions(history, input, limit = 8) {
  const needle = nameKey(input), seen = new Set(), candidates = [];
  for (const [names, source] of [[history, 'history'], [EXERCISE_SEEDS, 'seed']]) {
    for (const raw of names) {
      if (typeof raw !== 'string') continue;
      const name = raw.trim(), key = nameKey(name);
      if (!name || name.length > 100 || seen.has(key)) continue;
      seen.add(key);
      if (key.includes(needle)) candidates.push({ name, source });
      if (candidates.length === limit) return candidates;
    }
  }
  return candidates;
}
// D-05/D-10: own exercise_sets only; no new table or server privilege.
export async function loadExerciseNames(db, userId, signal) {
  if (!userId) throw new Error('missing_user');
  const names = [], seen = new Set();
  let cursor = null;
  for (;;) {
    let query = db.from('exercise_sets').select('id,exercise_name').eq('user_id', userId)
      .order('id', { ascending: false }).limit(500);
    if (cursor != null) query = query.lt('id', cursor);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('invalid_exercise_names');
    if (!data.length) return names;
    for (const row of data) {
      const id = String(row.id);
      if (!validActivityId(id) || (cursor != null && BigInt(id) >= BigInt(cursor))) throw new Error('invalid_exercise_cursor');
      cursor = id;
      if (typeof row.exercise_name !== 'string') continue;
      const name = row.exercise_name.trim(), key = nameKey(name);
      if (name && name.length <= 100 && !seen.has(key)) { seen.add(key); names.push(name); }
    }
  }
}
