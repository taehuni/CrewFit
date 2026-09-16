function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export function mergeInput(input) {
  if (!input || typeof input.from !== 'string' || typeof input.to !== 'string') {
    throw failure(400, 'INVALID_NAMES', '기존 이름과 통일할 이름을 입력해 주세요.');
  }
  const from = input.from.trim(), to = input.to.trim();
  if (!from || !to || from.length > 100 || to.length > 100 || from.toLowerCase() === to.toLowerCase()) {
    throw failure(400, 'INVALID_NAMES', '서로 다른 운동 이름을 1~100자로 입력해 주세요.');
  }
  return { from, to };
}

export async function mergeExerciseNames(db, input) {
  const { from, to } = mergeInput(input);
  const { data, error } = await db.rpc('merge_exercise_names', { p_from: from, p_to: to });
  if (error) {
    if (error.code === '23505') throw failure(409, 'CONFLICT', '같은 운동 기록 안에 통일할 이름의 동일 세트 번호가 있어요. 아무것도 변경하지 않았습니다. 해당 기록의 세트를 먼저 확인해 주세요.');
    if (error.code === '42501') throw failure(403, 'FORBIDDEN', '이 기록의 이름을 변경할 권한이 없어요.');
    if (error.code === '22023') throw failure(400, 'INVALID_NAMES', '서로 다른 운동 이름을 1~100자로 입력해 주세요.');
    if (error.code === 'PGRST202') throw failure(503, 'MIGRATION_REQUIRED', '운동 이름 정리용 DB 함수가 아직 적용되지 않았어요. 20260916_merge_exercise_names.sql 적용이 필요합니다.');
    throw failure(500, 'MERGE_FAILED', '변경 결과를 확인하지 못했어요. 기록을 새로 조회한 뒤 다시 확인해 주세요.');
  }
  if (!Number.isSafeInteger(data) || data < 0) throw failure(500, 'MERGE_FAILED', '변경 건수를 확인하지 못했어요. 기록을 새로 조회해 주세요.');
  if (data === 0) throw failure(404, 'NOT_FOUND', '변경할 이름이 더 이상 없어요. 기록을 새로 조회해 주세요.');
  return { updated: data };
}
