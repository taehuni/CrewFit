import {createHash} from 'node:crypto';

export const VIDEO_BUCKET = 'pose-videos';
export const MAX_VIDEO_BYTES = 32 * 1024 * 1024;
export const VIDEO_URL_TTL_SECONDS = 180;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (status, code, message) => Object.assign(new Error(message), {status, code});
const unavailable = () => fail(503, 'video_unavailable', '영상 보관을 아직 사용할 수 없어요. 측정 결과는 그대로 저장돼요.');
function checked(result) {if (result.error) throw unavailable(); return result.data;}
function publicVideo(row) {return {sessionId:row.id, expiresAt:null, durationSeconds:row.duration_seconds, sizeBytes:row.size_bytes};}
export function validateVideo(body, contentType, duration) {
  const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  const seconds = Number(duration);
  if (!Buffer.isBuffer(body) || body.length < 12 || body.length > MAX_VIDEO_BYTES) throw fail(400, 'invalid_video', '영상 크기를 확인해 주세요. 최대 32MB까지 보관할 수 있어요.');
  if (!['video/webm','video/mp4'].includes(mime) || !(seconds > 0 && seconds <= 120)) throw fail(400, 'invalid_video', '처음 2분 이내의 WebM 또는 MP4 영상만 보관할 수 있어요.');
  // Container signatures are validation, not a duration or codec inspection.
  if (mime === 'video/webm' ? body.readUInt32BE(0) !== 0x1a45dfa3 : body.toString('ascii',4,8) !== 'ftyp') throw fail(400, 'invalid_video', '영상 파일 형식을 확인해 주세요.');
  return {mime, seconds, hash:createHash('sha256').update(body).digest('hex')};
}

// Service role is confined to private video metadata/storage. Every request first
// checks the existing session using the caller's RLS client; no public bucket policies.
export function createPoseVideos({getAdmin = async () => (await import('../config/supabase.js')).supabaseAdmin} = {}) {
  async function checkSession(db, userId, id) {
    if (!UUID.test(id || '') || !UUID.test(userId || '')) throw fail(400,'invalid_session','측정 기록을 확인해 주세요.');
    const session = checked(await db.from('pose_sessions').select('id,user_id,created_at').eq('id',id).eq('user_id',userId).maybeSingle());
    if (!session) throw fail(404,'session_not_found','본인의 저장된 측정 기록에서 이용해 주세요.');
    return {session};
  }
  async function find(admin, userId, id) {return checked(await admin.from('pose_session_videos').select('*').eq('id',id).eq('user_id',userId).maybeSingle());}
  return {
    checkSession,
    async put(db, userId, id, body, mime, duration) {
      await checkSession(db,userId,id);
      const input = validateVideo(body,mime,duration), admin = await getAdmin();
      const candidate = {id,session_id:id,user_id:userId,object_path:`${userId}/${id}/${input.hash}.${input.mime === 'video/mp4' ? 'mp4' : 'webm'}`,mime_type:input.mime,size_bytes:body.length,duration_seconds:input.seconds,sha256:input.hash,state:'uploading'};
      const insertion = await admin.from('pose_session_videos').insert(candidate);
      if (insertion.error && insertion.error.code !== '23505') throw unavailable();
      const row = await find(admin,userId,id);
      if (!row || ['deleted','delete_pending'].includes(row.state) || row.sha256 !== input.hash || row.duration_seconds !== input.seconds) throw fail(409,'video_exists','이 측정의 영상이 이미 등록되어 있어요. 저장된 영상을 확인해 주세요.');
      if (row.state === 'ready') return {video:publicVideo(row)};
      const uploaded = await admin.storage.from(VIDEO_BUCKET).upload(row.object_path,body,{contentType:input.mime,upsert:false,cacheControl:'0'});
      if (uploaded.error && !['409','Duplicate'].includes(String(uploaded.error.statusCode || uploaded.error.code))) throw unavailable();
      // Explicit deletion racing an upload must not resurrect the video.
      const completion = await admin.from('pose_session_videos').update({state:'ready'}).eq('id',id).eq('user_id',userId).eq('state','uploading').select('*').maybeSingle();
      if (completion.error) throw unavailable();
      if (!completion.data) {
        const latest = await find(admin,userId,id);
        if (latest?.state === 'ready') return {video:publicVideo(latest)};
        checked(await admin.from('pose_session_videos').update({state:'delete_pending'}).eq('id',id).eq('user_id',userId));
        checked(await admin.storage.from(VIDEO_BUCKET).remove([row.object_path]));
        checked(await admin.from('pose_session_videos').update({state:'deleted'}).eq('id',id).eq('user_id',userId));
        throw fail(410,'video_deleted','삭제한 영상이에요. 측정 결과는 계속 볼 수 있어요.');
      }
      return {video:publicVideo(completion.data)};
    },
    async get(db,userId,id) {
      await checkSession(db,userId,id);
      const admin = await getAdmin(), row = await find(admin,userId,id);
      if (row?.state === 'delete_pending') return {video:null,deletionPending:true};
      if (!row || row.state !== 'ready') return {video:null};
      const signed = checked(await admin.storage.from(VIDEO_BUCKET).createSignedUrl(row.object_path,VIDEO_URL_TTL_SECONDS));
      return {video:{...publicVideo(row),url:signed.signedUrl}};
    },
    async remove(db,userId,id) {
      await checkSession(db,userId,id);
      const admin = await getAdmin(), row = await find(admin,userId,id);
      if (!row) return;
      checked(await admin.from('pose_session_videos').update({state:'delete_pending'}).eq('id',id).eq('user_id',userId));
      checked(await admin.storage.from(VIDEO_BUCKET).remove([row.object_path]));
      checked(await admin.from('pose_session_videos').update({state:'deleted'}).eq('id',id).eq('user_id',userId));
      // Keep the tombstone so late upload/retry cannot resurrect an explicit deletion.
    },
  };
}
