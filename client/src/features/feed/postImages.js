export const IMAGE_LIMIT = 5 * 1024 * 1024;
const extensions = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' };
export function validatePostImage(file) {
  if (!file || !Object.hasOwn(extensions,file.type)) throw new Error('JPG·PNG·WebP 사진만 첨부할 수 있어요.');
  if (!file.size || file.size > IMAGE_LIMIT) throw new Error('사진은 0바이트보다 크고 5MB 이하여야 해요.');
}
export function validateImagePath(path,userId) {
  if (path === null) return;
  if (typeof path !== 'string' || !path.startsWith(`${userId}/`) ||
    !/^[\da-f-]{36}\.(jpg|png|webp)$/i.test(path.slice(userId.length+1))) throw new Error('올바른 본인 사진 경로가 아니에요.');
}
export async function uploadPostImage(db,userId,file) {
  if (!userId) throw new Error('로그인이 필요해요.');
  validatePostImage(file);
  const path = `${userId}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const {error} = await db.storage.from('post-images').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
  if (error) throw new Error('사진 업로드를 확인하지 못했어요. 선택한 사진을 유지했으니 다시 시도해 주세요.');
  return path;
}
export async function signPostImages(db,paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const {data,error} = await db.storage.from('post-images').createSignedUrls(unique,3600);
  if (error || !Array.isArray(data)) throw new Error('사진을 불러오지 못했어요.');
  return Object.fromEntries(data.filter(row=>!row.error && row.signedUrl).map(row=>[row.path,row.signedUrl]));
}
