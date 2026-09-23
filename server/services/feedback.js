import { createHash } from 'node:crypto';
import { coachingModel, generateCoaching, requireFeedbackConfig } from './llm.js';
import { COACHING_INSTRUCTIONS } from './coachingInstructions.js';

const DAY = 86400000;
const PAGE = 500;
const inFlight = new Map();

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-24') return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function feedbackRange(period, value, now = new Date()) {
  const date = value ?? new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  if (!['day', 'week', 'month'].includes(period) || !validDate(date)) throw failure(400, 'INVALID_PERIOD', '기간과 올바른 날짜를 입력해 주세요.');
  const anchor = new Date(date + 'T00:00:00Z');
  if (period === 'week') anchor.setUTCDate(anchor.getUTCDate() - (anchor.getUTCDay() + 6) % 7);
  if (period === 'month') anchor.setUTCDate(1);
  const from = anchor.toISOString().slice(0, 10);
  let to = from;
  if (period === 'week') to = new Date(anchor.getTime() + 6 * DAY).toISOString().slice(0, 10);
  if (period === 'month') {
    const year = anchor.getUTCFullYear(), month = anchor.getUTCMonth() + 1;
    const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    to = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${days[month - 1]}`;
  }
  return { period, from, to, period_start: from };
}

export function feedbackInput(input, now) {
  if (!input || typeof input !== 'object' || (input.force != null && typeof input.force !== 'boolean')) {
    throw failure(400, 'INVALID_PERIOD', '기간과 올바른 날짜를 입력해 주세요.');
  }
  return { range: feedbackRange(input.period, input.date, now), force: input.force === true };
}

export function buildFeedbackPrompt(source) {
  const activities = source.activities || [];
  const summary = {
    activity_count: activities.length,
    duration_sec: activities.reduce((sum, row) => sum + (row.duration_sec ?? 0), 0),
    sports: [...new Set(activities.map(row => row.sport))].sort().map(sport => {
      const rows = activities.filter(row => row.sport === sport);
      return { sport, count: rows.length, duration_sec: rows.reduce((sum, row) => sum + (row.duration_sec ?? 0), 0),
        distance_m: rows.some(row => row.distance_m != null) ? rows.reduce((sum, row) => sum + (row.distance_m ?? 0), 0) : null };
    }),
    exercise_set_count: source.exercise_sets?.length || 0,
    meal_record_count: source.meals?.length || 0,
  };
  const prompt = [
    `다음은 ${source.range.from}부터 ${source.range.to}까지의 CrewFit 사용자 기록입니다.`,
    '이전 기간 비교 자료는 없습니다. 활성 목표는 현재 설정이며 과거 목표 이력은 아닙니다.',
    '단위: duration_sec는 초, distance_m는 미터, weight_kg는 kg, reps는 반복 횟수입니다.',
    'summary는 서버 집계입니다. 기록이 없는 부분을 0의 성과나 결핍으로 해석하지 마세요.',
    '<user_data>',
    JSON.stringify({ ...source, summary }).replaceAll('<', '\\u003c'),
    '</user_data>',
  ].join('\n');
  if (prompt.length > 120000) throw failure(413, 'DATA_TOO_LARGE', '이 기간의 기록이 너무 많아 피드백을 만들 수 없어요. 더 짧은 기간을 선택해 주세요.');
  return prompt;
}

export function feedbackHash(prompt, model) {
  return createHash('sha256').update(COACHING_INSTRUCTIONS).update('\n').update(prompt).update('\nMODEL:').update(model).digest('hex');
}

export function createRateLimiter({ now = () => Date.now(), minuteLimit = 5, dayLimit = 20 } = {}) {
  const calls = new Map();
  return {
    take(userId) {
      const time = now(), dayAgo = time - 86400000, minuteAgo = time - 60000;
      const recent = (calls.get(userId) || []).filter(value => value > dayAgo);
      if (recent.filter(value => value > minuteAgo).length >= minuteLimit || recent.length >= dayLimit) {
        throw failure(429, 'RATE_LIMIT', 'AI 피드백 호출 한도에 도달했어요. 잠시 후 다시 시도해 주세요.');
      }
      recent.push(time); calls.set(userId, recent);
    },
    clear() { calls.clear(); },
  };
}

export const feedbackRateLimiter = createRateLimiter();

async function allRows(makeQuery) {
  const rows = [];
  let cursor = null;
  for (;;) {
    let query = makeQuery().order('id', { ascending: true }).limit(PAGE);
    if (cursor != null) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('invalid_feedback_source');
    if (!data.length) break;
    const next = data.at(-1)?.id;
    if (next == null || (cursor != null && BigInt(next) <= BigInt(cursor))) throw new Error('invalid_feedback_cursor');
    rows.push(...data); cursor = next;
  }
  return rows;
}

export async function loadFeedbackSource(db, userId, range) {
  const activities = await allRows(() => db.from('activities')
    .select('id,sport,performed_on,duration_sec,distance_m,details,note')
    .eq('user_id', userId).gte('performed_on', range.from).lte('performed_on', range.to));
  const meals = await allRows(() => db.from('meals')
    .select('id,eaten_on,meal_type,items,note')
    .eq('user_id', userId).gte('eaten_on', range.from).lte('eaten_on', range.to));
  if (!activities.length && !meals.length) throw failure(400, 'NO_DATA', '이 기간에는 피드백을 만들 운동이나 식단 기록이 없어요.');
  const gymIds = activities.filter(item => item.sport === 'gym').map(item => item.id);
  const exercise_sets = [];
  for (let offset = 0; offset < gymIds.length; offset += 100) {
    exercise_sets.push(...await allRows(() => db.from('exercise_sets')
      .select('id,activity_id,exercise_name,set_no,reps,weight_kg')
      .eq('user_id', userId).in('activity_id', gymIds.slice(offset, offset + 100))));
  }
  const goals = await allRows(() => db.from('goals').select('id,type,sport,target,period').eq('user_id', userId).eq('is_active', true));
  const [{ data: profile, error: profileError }, { data: settings, error: settingsError }] = await Promise.all([
    db.from('profiles').select('main_sport').eq('id', userId).maybeSingle(),
    db.from('user_settings').select('goal_note').eq('user_id', userId).maybeSingle(),
  ]);
  if (profileError || settingsError) throw profileError || settingsError;
  return { range, profile: { main_sport: profile?.main_sport ?? null, goal_note: settings?.goal_note ?? null }, goals, activities, exercise_sets, meals };
}

async function loadExisting(db, userId, range) {
  // The migration installs both the table and archive trigger in one transaction.
  // Check before a paid generation so an old DB cannot silently overwrite history.
  const { error: historyError } = await db.from('ai_feedback_history').select('id').eq('user_id', userId).limit(0);
  if (historyError) throw failure(503, 'HISTORY_REQUIRED', '코칭 이력 DB 설정이 필요해요. 20260921_feedback_history.sql을 적용해 주세요.');
  const { data, error } = await db.from('ai_feedbacks')
    .select('id,period,period_start,content,model,source_hash,regen_count,llm_calls,created_at')
    .eq('user_id', userId).eq('period', range.period).eq('period_start', range.period_start).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function saveFeedback(admin, row) {
  const { data, error } = await admin.from('ai_feedbacks').upsert(row, { onConflict: 'user_id,period,period_start' })
    .select('id,period,period_start,content,model,source_hash,regen_count,llm_calls,created_at').single();
  if (error || !data) throw error || new Error('missing_feedback_result');
  return data;
}

function response(row, cached) {
  return { id: row.id, period: row.period, period_start: row.period_start, content: row.content, model: row.model,
    regen_count: row.regen_count, remaining_regenerations: Math.max(0, 3 - row.regen_count), cached, created_at: row.created_at };
}

export async function generateFeedback({
  db, admin, userId, input, now = new Date(), model = coachingModel(), limiter = feedbackRateLimiter,
  ensureConfig = requireFeedbackConfig, loadSource = loadFeedbackSource, findExisting = loadExisting,
  callLLM = generateCoaching, save = saveFeedback, locks = inFlight,
  resolveAdmin = async () => (await import('../config/supabase.js')).supabaseAdmin,
}) {
  if (!userId) throw failure(401, 'UNAUTHORIZED', '로그인이 필요해요.');
  let parsed;
  try { parsed = feedbackInput(input, now); }
  catch (error) {
    if (error.status) throw error;
    throw failure(503, 'CONFIG_REQUIRED', 'AI 피드백 서버 설정이 아직 완료되지 않았어요.');
  }
  const { range, force } = parsed;
  const key = `${userId}:${range.period}:${range.period_start}`;
  if (locks.has(key)) return locks.get(key);
  const job = (async () => {
    let existing;
    try { existing = await findExisting(db, userId, range); }
    catch (error) {
      if (error.code === 'HISTORY_REQUIRED') throw error;
      throw failure(500, 'FEEDBACK_LOAD_FAILED', '기존 피드백을 확인하지 못했어요.');
    }
    if (force && existing?.regen_count >= 3) throw failure(429, 'REGEN_LIMIT', '이 기간의 다시 생성 횟수를 모두 사용했어요.');
    let source;
    try { source = await loadSource(db, userId, range); }
    catch (error) {
      if (error.status) throw error;
      throw failure(500, 'FEEDBACK_LOAD_FAILED', '피드백에 필요한 기록을 불러오지 못했어요.');
    }
    const prompt = buildFeedbackPrompt(source), source_hash = feedbackHash(prompt, model);
    if (!force && existing?.source_hash === source_hash) return response(existing, true);
    try { ensureConfig(); }
    catch { throw failure(503, 'CONFIG_REQUIRED', 'AI 피드백 서버 설정이 아직 완료되지 않았어요.'); }
    if (!admin) {
      try { admin = await resolveAdmin(); }
      catch { throw failure(503, 'CONFIG_REQUIRED', 'AI 피드백 서버 설정이 아직 완료되지 않았어요.'); }
    }
    limiter.take(userId);
    let generated;
    try { generated = await callLLM(prompt, { model }); }
    catch (error) {
      if (error.code === 'CONFIG_REQUIRED') throw failure(503, 'CONFIG_REQUIRED', 'AI 피드백 서버 설정이 아직 완료되지 않았어요.');
      if (error.code === 'LLM_REFUSED') throw failure(422, 'LLM_REFUSED', error.message);
      throw failure(502, 'LLM_FAILED', 'AI 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    const row = { user_id: userId, period: range.period, period_start: range.period_start, content: generated.content,
      model: generated.model || model, source_hash, regen_count: existing ? existing.regen_count + (force ? 1 : 0) : 0,
      llm_calls: (existing?.llm_calls || 0) + 1, created_at: now.toISOString() };
    let saved;
    try { saved = await save(admin, row); }
    catch { throw failure(500, 'FEEDBACK_SAVE_FAILED', '피드백 저장 결과를 확인하지 못했어요. 다시 생성하지 말고 잠시 후 새로고침해 주세요.'); }
    return response(saved, false);
  })();
  locks.set(key, job);
  try { return await job; } finally { if (locks.get(key) === job) locks.delete(key); }
}
