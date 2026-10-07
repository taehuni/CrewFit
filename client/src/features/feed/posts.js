import { validCrewId, SPORTS } from '../crews/crews.js';
import { validateImagePath } from './postImages.js';
import { ownAttachment } from './postActivities.js';
import { loadOwnRoute, TRACKING_SPORTS } from '../tracking/index.js';

export const KINDS = {free:'자유', recruit:'모집',log:'인증'};
const FIELDS = 'id,author_id,crew_id,visibility,kind,sport,content,image_path,activity_id,include_route,is_pinned,created_at,updated_at,profiles!posts_author_id_fkey(nickname),crews(name,owner_id,sport),activities!posts_activity_id_fkey(id,sport,duration_sec,distance_m)';
export const feedUrl = crewId => crewId ? `/feed?crew=${crewId}` : '/feed';
export function postInput(form, crewId) {
  const content = form.content?.trim() || '';
  if (!content || content.length > 5000) throw new Error('본문을 1~5,000자로 입력해 주세요.');
  if (!Object.hasOwn(KINDS,form.kind)) throw new Error('글 종류를 선택해 주세요.');
  if (!['public','crew'].includes(form.visibility) || (form.visibility==='crew' && !crewId)) throw new Error('크루 전용 글은 크루를 선택해야 해요.');
  if (form.sport && !Object.hasOwn(SPORTS,form.sport)) throw new Error('종목을 다시 선택해 주세요.');
  return {content, kind:form.kind, visibility:form.visibility, sport:form.sport || null};
}
export async function feedContext(db, crewId) {
  if (!crewId) return {crew:null, canWrite:true};
  if (!validCrewId(crewId)) throw new Error('올바른 크루 주소가 아니에요.');
  const [crew, permission] = await Promise.all([
    db.from('crews').select('id,name,sport,owner_id').eq('id',crewId).maybeSingle(),
    db.rpc('can_post_in_crew',{p_crew_id:crewId}),
  ]);
  if (crew.error || permission.error) throw new Error('크루 권한을 확인하지 못했어요.');
  if (!crew.data) throw new Error('크루를 찾을 수 없어요.');
  return {crew:crew.data, canWrite:permission.data===true};
}
export async function loadPosts(db, crewId, kind='', cursor=null) {
  if (crewId && !validCrewId(crewId)) throw new Error('올바른 크루 주소가 아니에요.');
  if (kind && !Object.hasOwn(KINDS,kind)) throw new Error('올바른 글 종류가 아니에요.');
  if(cursor!=null && (crewId ? !cursor || typeof cursor.is_pinned!=='boolean' || !validCrewId(String(cursor.id)) : !validCrewId(String(cursor))))throw new Error('목록을 새로 조회해 주세요.');
  let query=db.from('posts').select(FIELDS);
  if(crewId)query=query.order('is_pinned',{ascending:false});
  query=query.order('id',{ascending:false}).limit(21);
  query=crewId ? query.eq('crew_id',crewId) : query.eq('visibility','public');
  if(kind)query=query.eq('kind',kind);
  if(cursor!=null){
    if(!crewId)query=query.lt('id',cursor);
    else if(cursor.is_pinned)query=query.or(`and(is_pinned.eq.true,id.lt.${cursor.id}),is_pinned.eq.false`);
    else query=query.eq('is_pinned',false).lt('id',cursor.id);
  }
  const {data,error}=await query;
  if(error || !Array.isArray(data))throw new Error('피드를 불러오지 못했어요.');
  const rows=data.slice(0,20),last=rows.at(-1);
  return {rows,next:data.length>20 ? crewId ? {id:last.id,is_pinned:last.is_pinned} : last.id : undefined};
}
export function canPinPost(post,userId){return !!userId && !!post.crew_id && post.author_id===userId && post.crews?.owner_id===userId;}
export async function setPostPinned(db,userId,post,pinned){
  if(!canPinPost(post,userId) || typeof pinned!=='boolean')throw new Error('크루장 본인이 작성한 크루 글만 고정할 수 있어요.');
  const permission=await db.rpc('is_crew_owner',{p_crew_id:post.crew_id});
  if(permission.error || permission.data!==true)throw new Error('크루장 권한을 확인하지 못했어요. 다시 조회해 주세요.');
  const {data,error}=await db.from('posts').update({is_pinned:pinned}).eq('id',post.id).eq('author_id',userId)
    .eq('crew_id',post.crew_id).eq('updated_at',post.updated_at).eq('is_pinned',post.is_pinned).select('id').maybeSingle();
  if(error || !data)throw new Error('글이나 권한이 변경됐어요. 다시 조회한 뒤 시도해 주세요.');
}
export async function loadPost(db,id) {
  if(!validCrewId(id))return null;
  const {data,error}=await db.from('posts').select(FIELDS).eq('id',id).maybeSingle();
  if(error)throw new Error('글을 불러오지 못했어요.');
  return data;
}
export async function savePost(db,userId,form,crewId=null,existing=null,imagePath=undefined,activityId=undefined,includeRoute=undefined) {
  if(!userId)throw new Error('로그인이 필요해요.');
  if(crewId && !validCrewId(String(crewId)))throw new Error('올바른 크루 주소가 아니에요.');
  if(existing && (existing.author_id!==userId || !Object.hasOwn(KINDS,existing.kind)))throw new Error('수정할 수 없는 글이에요.');
  if(existing && String(existing.crew_id ?? '')!==String(crewId ?? ''))throw new Error('수정할 때 크루는 바꿀 수 없어요.');
  const input=postInput(form,crewId);
  if(activityId!==undefined){
    if(activityId!==null){const activity=await ownAttachment(db,userId,activityId);input.sport=activity.sport;}
    input.activity_id=activityId;input.include_route=false;
  }
  if(includeRoute!==undefined){
    if(typeof includeRoute!=='boolean')throw new Error('경로 공유 여부를 확인해 주세요.');
    const routeActivity=activityId===undefined?existing?.activity_id:activityId;
    if(includeRoute){
      if(!routeActivity)throw new Error('경로를 공유할 운동 기록을 선택해 주세요.');
      const activity=await ownAttachment(db,userId,routeActivity);
      if(!TRACKING_SPORTS.includes(activity.sport) || !(await loadOwnRoute(db,userId,routeActivity)))throw new Error('GPS 경로가 있는 본인 운동 기록만 공유할 수 있어요.');
    }
    input.include_route=includeRoute;
  }
  if(imagePath!==undefined){validateImagePath(imagePath,userId);input.image_path=imagePath;}
  let query;
  if(existing) query=db.from('posts').update(input).eq('id',existing.id).eq('author_id',userId).eq('updated_at',existing.updated_at);
  else {
    if(crewId && !(await feedContext(db,String(crewId))).canWrite)throw new Error('크루장이 글 작성 권한을 허용해야 해요.');
    query=db.from('posts').insert({...input,author_id:userId,crew_id:crewId || null});
  }
  const {data,error}=await query.select('id').maybeSingle();
  if(error)throw new Error('저장 결과를 확인하지 못했어요. 피드를 확인한 뒤 다시 시도해 주세요.');
  if(!data)throw new Error('글이 변경되었거나 권한이 바뀌었어요. 다시 조회해 주세요.');
  return data;
}
export async function deletePost(db,userId,post) {
  if(!userId || (post.author_id!==userId && post.crews?.owner_id!==userId))throw new Error('삭제 권한이 없어요.');
  let query=db.from('posts').delete().eq('id',post.id).eq('updated_at',post.updated_at);
  query=post.author_id===userId ? query.eq('author_id',userId) : query.eq('crew_id',post.crew_id);
  const {data,error}=await query.select('id');
  if(error || !data?.length)throw new Error('삭제 결과를 확인하지 못했어요. 글을 다시 조회해 주세요.');
}
