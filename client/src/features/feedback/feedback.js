const DAY = 86400000;

export const FEEDBACK_PERIODS = [
  { value: 'day', label: '하루' },
  { value: 'week', label: '한 주' },
  { value: 'month', label: '한 달' },
];

export function kstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

function dateFrom(value) {
  return new Date(value + 'T00:00:00Z');
}

export function feedbackPeriodStart(period, value) {
  const date = dateFrom(value);
  if (period === 'week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  if (period === 'month') date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
}

export async function loadSavedFeedback(db, userId, period, date) {
  const { data, error } = await db.from('ai_feedbacks')
    .select('id,period,period_start,content,model,regen_count,created_at')
    .eq('user_id', userId).eq('period', period)
    .eq('period_start', feedbackPeriodStart(period, date)).maybeSingle();
  if (error) throw error;
  return data ? { ...data, cached: true, remaining_regenerations: Math.max(0, 3 - data.regen_count) } : null;
}

function short(value) {
  const date = dateFrom(value);
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;
}

export async function loadFeedbackHistory(db, userId, cursor = null) {
  let query = db.from('ai_feedback_history')
    .select('id,period,period_start,content,created_at')
    .eq('user_id', userId).order('id', { ascending: false }).limit(20);
  if (cursor != null) query = query.lt('id', cursor);
  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('코칭 이력을 불러오지 못했어요.');
  return { rows: data, nextCursor: data.length ? data.at(-1).id : undefined };
}

export function feedbackPeriodLabel(period, value) {
  const anchor = dateFrom(value);
  if (period === 'day') return short(value);
  if (period === 'week') {
    anchor.setUTCDate(anchor.getUTCDate() - (anchor.getUTCDay() + 6) % 7);
    const end = new Date(anchor.getTime() + 6 * DAY);
    return `${short(anchor.toISOString().slice(0, 10))} — ${short(end.toISOString().slice(0, 10))}`;
  }
  return `${anchor.getUTCFullYear()}년 ${anchor.getUTCMonth() + 1}월`;
}

export function feedbackError(error) {
  if (error?.code === 'NO_DATA') return '선택한 기간에 운동이나 식단 기록이 없어요. 기록을 남긴 뒤 다시 확인해 주세요.';
  if (error?.code === 'CONFIG_REQUIRED') return 'AI 코칭 준비가 아직 끝나지 않았어요. 서버 환경 설정을 확인해 주세요.';
  if (error?.code === 'REGEN_LIMIT') return '이 기간의 다시 생성 횟수를 모두 사용했어요.';
  if (error?.code === 'RATE_LIMIT') return 'AI 코칭 호출 한도에 도달했어요. 잠시 후 다시 시도해 주세요.';
  return error?.message || 'AI 코칭을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
}
