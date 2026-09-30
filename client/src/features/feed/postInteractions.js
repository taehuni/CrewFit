import { validCrewId } from '../crews/crews.js';
function validPost(id) { if(!validCrewId(String(id)))throw new Error('올바른 글 주소가 아니에요.'); }
export function commentInput(content) {
  const text=typeof content==='string'?content.trim():'';
  if(!text || text.length>1000)throw new Error('댓글을 1~1,000자로 입력해 주세요.');
  return text;
}
async function visiblePost(db,userId,id) {
  validPost(id);if(!userId)throw new Error('로그인이 필요해요.');
  const {data,error}=await db.from('posts').select('id,crew_id,crews(owner_id)').eq('id',id).maybeSingle();
  if(error || !data)throw new Error('글이 삭제되었거나 접근 권한이 변경됐어요.');
  return data;
}
export async function likeSummary(db,userId,postId) {
  validPost(postId);
  const [total,mine]=await Promise.all([
    db.from('post_likes').select('user_id',{head:true,count:'exact'}).eq('post_id',postId),
    db.from('post_likes').select('user_id').eq('post_id',postId).eq('user_id',userId).maybeSingle(),
  ]);
  if(total.error || mine.error || typeof total.count!=='number')throw new Error('좋아요를 불러오지 못했어요.');
  return {count:total.count,liked:!!mine.data};
}
export async function interactionPage(db,postId,type,cursor=null) {
  validPost(postId);
  if(!['comments','likes'].includes(type))throw new Error('올바른 목록이 아니에요.');
  const comments=type==='comments',column=comments?'id':'user_id';
  let query=db.from(comments?'comments':'post_likes').select(comments?
    'id,post_id,author_id,content,created_at,updated_at,profiles!comments_author_id_fkey(nickname)':
    'user_id,profiles!post_likes_user_id_fkey(nickname)').eq('post_id',postId).order(column,{ascending:true}).limit(20);
  if(cursor!=null)query=query.gt(column,cursor);
  const {data,error}=await query;
  if(error || !Array.isArray(data))throw new Error('목록을 불러오지 못했어요.');
  return {rows:data,next:data.length?data.at(-1)[column]:undefined};
}
export async function setLike(db,userId,postId,liked) {
  await visiblePost(db,userId,postId);
  if(liked){
    const {error}=await db.from('post_likes').insert({post_id:postId,user_id:userId});
    if(error && error.code!=='23505')throw new Error('좋아요 결과를 확인하지 못했어요. 다시 조회해 주세요.');
  }else{
    const {error}=await db.from('post_likes').delete().eq('post_id',postId).eq('user_id',userId);
    if(error)throw new Error('좋아요 취소를 확인하지 못했어요. 다시 조회해 주세요.');
  }
}
export async function saveComment(db,userId,postId,content,existing=null) {
  const text=commentInput(content);
  if(existing && (existing.author_id!==userId || String(existing.post_id)!==String(postId)))throw new Error('본인 댓글만 수정할 수 있어요.');
  await visiblePost(db,userId,postId);
  const table=db.from('comments');
  const query=existing?table.update({content:text}).eq('id',existing.id).eq('post_id',postId).eq('author_id',userId).eq('updated_at',existing.updated_at):
    table.insert({post_id:postId,author_id:userId,content:text});
  const {data,error}=await query.select('id').maybeSingle();
  if(error || !data)throw new Error('댓글 저장을 확인하지 못했어요. 목록을 확인한 뒤 다시 시도해 주세요.');
  return data;
}
export async function deleteComment(db,userId,postId,comment) {
  const post=await visiblePost(db,userId,postId);
  if(String(comment.post_id)!==String(postId) || (comment.author_id!==userId && post.crews?.owner_id!==userId))throw new Error('댓글 삭제 권한이 없어요.');
  let query=db.from('comments').delete().eq('id',comment.id).eq('post_id',postId).eq('updated_at',comment.updated_at);
  if(comment.author_id===userId)query=query.eq('author_id',userId);
  const {data,error}=await query.select('id');
  if(error || !data?.length)throw new Error('댓글 삭제를 확인하지 못했어요. 다시 조회해 주세요.');
}
