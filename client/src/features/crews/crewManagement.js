function requireOwner(crew, userId) {
  if (!userId || crew.owner_id !== userId) throw new Error('크루장만 회원을 관리할 수 있어요.');
}

export async function loadCrewMembers(db, crew, userId, offset = 0) {
  requireOwner(crew, userId);
  const { data, error } = await db.from('crew_members').select('user_id,status,can_post,joined_at')
    .eq('crew_id', crew.id).order('joined_at').order('user_id').range(offset, offset + 49);
  if (error) throw new Error('회원 목록을 불러오지 못했어요.');
  const members = data || [];
  if (!members.length) return { members: [], next: undefined };
  const profiles = await db.from('profiles').select('id,nickname').in('id', members.map(member => member.user_id));
  if (profiles.error) throw new Error('회원 닉네임을 불러오지 못했어요.');
  const names = members.some(member => member.status === 'approved')
    ? await db.rpc('crew_member_names', { p_crew_id: crew.id }) : { data: [] };
  if (names.error) throw new Error('회원 이름을 불러오지 못했어요.');
  return {
    members: members.map(member => ({ ...member,
      nickname: profiles.data?.find(profile => profile.id === member.user_id)?.nickname || '회원',
      real_name: member.status === 'approved' ? names.data?.find(name => name.user_id === member.user_id)?.real_name : null,
    })),
    next: members.length === 50 ? offset + 50 : undefined,
  };
}

export async function updateCrewMember(db, crew, userId, member, action) {
  requireOwner(crew, userId);
  if (member.user_id === userId || member.status !== 'approved' || !['kick', 'permission'].includes(action))
    throw new Error('승인된 다른 크루원만 변경할 수 있어요.');
  const table = db.from('crew_members');
  let mutation = action === 'kick' ? table.delete() : table.update({ can_post: !member.can_post });
  mutation = mutation.eq('crew_id', crew.id).eq('user_id', member.user_id).eq('status', 'approved');
  if (action === 'permission') mutation = mutation.eq('can_post', member.can_post);
  const { data, error } = await mutation.select('user_id');
  if (error) throw new Error('회원 정보를 변경하지 못했어요. 다시 조회해 주세요.');
  if (!data?.length) throw new Error('회원 상태가 변경됐어요. 다시 조회해 주세요.');
}
