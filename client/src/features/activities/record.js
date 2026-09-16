import { ACTIVITY_SPORTS, distanceFactor, hasDistance } from './sports.js';

export function activityPayload(form, { editing = false } = {}) {
  const errors = {};
  if (!ACTIVITY_SPORTS.includes(form.sport)) errors.sport = '종목을 선택해 주세요.';
  const date = new Date(form.date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !Number.isFinite(date.getTime())
    || date.toISOString().slice(0, 10) !== form.date || form.date < '1900-01-01' || form.date > '9999-12-24') errors.date = '올바른 운동 날짜를 입력해 주세요.';
  const minutes = Number(form.minutes);
  const seconds = Number(form.seconds ?? '0');
  if (!String(form.minutes).trim() || !Number.isInteger(minutes) || minutes < 0 || minutes > 35791394 || minutes * 60 + seconds > 2147483647) errors.minutes = '분은 0 이상의 정수로 입력하고, 전체 시간은 저장 가능한 범위 이내로 입력해 주세요.';
  if (!String(form.seconds ?? '0').trim() || !Number.isInteger(seconds) || seconds < 0 || seconds > 59) errors.seconds = '초는 0~59의 정수로 입력해 주세요.';
  if (!editing && !errors.minutes && !errors.seconds && minutes * 60 + seconds === 0) errors.minutes = '운동 시간을 1초 이상 입력해 주세요.';
  const distance = Number(form.distance);
  const noDistance = !String(form.distance).trim();
  const factor = distanceFactor(form.sport);
  if (hasDistance(form.sport) && !(editing && noDistance) &&
    (noDistance || !Number.isFinite(distance) || distance < 0 || distance * factor > 2147483647 ||
      Math.abs(distance * factor - Math.round(distance * factor)) > .000001)) {
    errors.distance = form.sport === 'swimming' ? '거리를 0 이상의 정수(m)로 입력해 주세요.' : '거리는 0 이상, 소수 셋째 자리까지 입력해 주세요.';
  }
  let details;
  if (form.sport === 'swimming') {
    const lapText = String(form.lapCount ?? '').trim(), lapCount = Number(lapText);
    if (lapText && (!Number.isInteger(lapCount) || lapCount < 0 || lapCount > 10000)) errors.lapCount = '랩 수는 0~10,000의 정수로 입력해 주세요.';
    if (!editing || lapText !== String(form.originalLapCount ?? '').trim()) {
      const original = form.originalDetails ?? {};
      if (typeof original !== 'object' || Array.isArray(original)) errors.lapCount = '기존 세부 정보 형식을 확인해야 랩 수를 수정할 수 있어요.';
      else {
        details = { ...original };
        if (lapText) details.lap_count = lapCount;
        else delete details.lap_count;
      }
    }
  }
  if ((form.note || '').length > 1000) errors.note = '메모는 1,000자 이내로 입력해 주세요.';
  const sets = [];
  const numbers = new Map();
  if (form.sport === 'gym') {
    if (!form.sets?.length || form.sets.length > 100) errors.sets = '세트를 1~100개 입력해 주세요.';
    for (const [index, row] of (form.sets || []).entries()) {
      const name = row.name.trim();
      const reps = editing && !String(row.reps).trim() ? null : Number(row.reps);
      const weight = editing && !String(row.weight).trim() ? null : Number(row.weight);
      if (!name || name.length > 100) errors['name-' + index] = '운동 이름을 1~100자로 입력해 주세요.';
      if (!(editing && reps === null) && ((!editing && !String(row.reps).trim()) || !Number.isInteger(reps) || reps < (editing ? 0 : 1) || reps > 32767)) errors['reps-' + index] = '횟수를 올바른 정수로 입력해 주세요.';
      if (!(editing && weight === null) && ((!editing && !String(row.weight).trim()) || !Number.isFinite(weight) || weight < 0 || weight > 9999.99 || Math.abs(weight * 100 - Math.round(weight * 100)) > .000001)) errors['weight-' + index] = '중량은 0~9999.99kg, 소수 둘째 자리까지 입력해 주세요.';
      const key = name.toLowerCase();
      const setNo = (numbers.get(key) || 0) + 1;
      numbers.set(key, setNo);
      sets.push({ exercise_name: name, set_no: setNo, reps, weight_kg: weight });
    }
  }
  return { errors, activity: { sport: form.sport, performed_on: form.date, duration_sec: minutes * 60 + seconds,
    distance_m: hasDistance(form.sport) && !noDistance ? Math.round(distance * factor) : null,
    ...(details === undefined ? {} : { details }), note: form.note?.trim() || null }, sets };
}

export function activityFormValues({ activity, sets }) {
  return {
    sport: activity.sport, date: activity.performed_on,
    minutes: String(Math.floor(activity.duration_sec / 60)), seconds: String(activity.duration_sec % 60),
    distance: activity.distance_m == null ? '' : String(activity.distance_m / distanceFactor(activity.sport)),
    lapCount: activity.details?.lap_count == null ? '' : String(activity.details.lap_count),
    originalLapCount: activity.details?.lap_count == null ? '' : String(activity.details.lap_count),
    originalDetails: activity.details,
    note: activity.note ?? '',
    sets: sets.length ? sets.map(row => ({ name: row.exercise_name, reps: row.reps == null ? '' : String(row.reps), weight: row.weight_kg == null ? '' : String(row.weight_kg) })) : [{ name: '', reps: '', weight: '' }],
  };
}

// D-10: single-table insert directly with RLS. D-22: gym and sets in one RPC transaction.
export async function saveActivity(db, userId, payload) {
  const { activity, sets } = payload;
  const result = activity.sport === 'gym'
    ? await db.rpc('save_gym_activity', {
      p_performed_on: activity.performed_on, p_duration_sec: activity.duration_sec,
      p_note: activity.note, p_sets: sets,
    })
    : await db.from('activities').insert({ ...activity, user_id: userId });
  if (result.error) throw result.error;
}
