function failure(status, code, message) { return Object.assign(new Error(message), {status,code}); }

export async function moderateCrewRequest(db, userId, crewId, targetId, action) {
  if (!userId) throw failure(401, 'UNAUTHORIZED', '로그인이 필요해요.');
  if (typeof crewId !== 'string' || !/^[1-9]\d*$/.test(crewId) || BigInt(crewId) > 9223372036854775807n)
    throw failure(400, 'INVALID_CREW', '올바른 크루 주소가 아니에요.');
  if (typeof targetId !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(targetId) || !['approve', 'reject'].includes(action))
    throw failure(400, 'INVALID_REQUEST', '올바른 가입 요청이 아니에요.');
  const { data: crew, error } = await db.from('crews').select('owner_id').eq('id', crewId).maybeSingle();
  if (error) throw failure(500, 'CREW_LOAD_FAILED', '크루 정보를 확인하지 못했어요.');
  if (!crew) throw failure(404, 'CREW_NOT_FOUND', '크루를 찾을 수 없어요.');
  if (crew.owner_id !== userId || targetId.toLowerCase() === userId.toLowerCase())
    throw failure(403, 'FORBIDDEN', '크루장만 다른 회원의 가입 요청을 처리할 수 있어요.');
  const table = db.from('crew_members');
  const mutation = action === 'approve' ? table.update({ status: 'approved', can_post: false }) : table.delete();
  const result = await mutation.eq('crew_id', crewId).eq('user_id', targetId).eq('status', 'pending').select('user_id');
  if (result.error) throw failure(result.error.code === '42501' ? 403 : 500, 'MODERATION_FAILED', '가입 요청을 처리하지 못했어요. 다시 조회해 주세요.');
  if (!result.data?.length) throw failure(409, 'REQUEST_CHANGED', '이미 처리되거나 취소된 요청이에요. 다시 조회해 주세요.');
  return { ok: true };
}

export async function joinCrew(db, userId, crewId) {
  if (!userId) throw failure(401,'UNAUTHORIZED','로그인이 필요해요.');
  if (typeof crewId !== 'string' || !/^[1-9]\d*$/.test(crewId) || BigInt(crewId)>9223372036854775807n) throw failure(400,'INVALID_CREW','올바른 크루 주소가 아니에요.');
  const {data:crew,error:crewError}=await db.from('crews').select('join_mode').eq('id',crewId).maybeSingle();
  if(crewError) throw failure(500,'CREW_LOAD_FAILED','크루 정보를 확인하지 못했어요.');
  if(!crew) throw failure(404,'CREW_NOT_FOUND','크루를 찾을 수 없어요.');
  const readMember=()=>db.from('crew_members').select('status').eq('crew_id',crewId).eq('user_id',userId).maybeSingle();
  const existing=await readMember();
  if(existing.error) throw failure(500,'MEMBERSHIP_LOAD_FAILED','가입 상태를 확인하지 못했어요.');
  if(existing.data) return {status:existing.data.status};
  const status=crew.join_mode==='open'?'approved':'pending';
  const {data,error}=await db.from('crew_members').insert({crew_id:crewId,user_id:userId,status,can_post:false}).select('status').single();
  if(error?.code==='23505') {
    const current=await readMember();
    if(!current.error && current.data) return {status:current.data.status};
  }
  if(error?.code==='42501') throw failure(409,'CREW_CHANGED','가입 조건이 변경됐어요. 크루를 다시 조회해 주세요.');
  if(error || !data) throw failure(500,'JOIN_FAILED','가입 결과를 확인하지 못했어요. 현재 상태를 다시 조회해 주세요.');
  return {status:data.status};
}
