export const setupMissing = error => ['42P01','PGRST205','PGRST202'].includes(error?.code);
export const setupMessage='새 기능을 연결하는 중이에요. 잠시 후 다시 시도해 주세요.';
export async function optionalResult(query) {
  const result=await query;
  if(setupMissing(result.error))return null;
  if(result.error)throw new Error('정보를 불러오지 못했어요. 다시 시도해 주세요.');
  return result.data;
}
export async function saveResult(query){const r=await query;if(r.error)throw new Error(setupMissing(r.error)?setupMessage:'저장하지 못했어요. 다시 시도해 주세요.');return r.data;}
export async function mediaUrl(db,path){
  if(!path)return null;
  const {data,error}=await db.storage.from('community-media').createSignedUrl(path,3600);
  // Keep the saved metadata editable if an old object was removed or signing fails.
  return error?null:data.signedUrl;
}
export async function loadMemberCard(db,id){const data=await optionalResult(db.from('member_cards').select('avatar_path,bio').eq('user_id',id).maybeSingle());return data?{...data,url:await mediaUrl(db,data.avatar_path)}:null;}
export async function loadCover(db,id){const data=await optionalResult(db.from('crew_covers').select('image_path').eq('crew_id',id).maybeSingle());return data?{...data,url:await mediaUrl(db,data.image_path)}:null;}
export function validatePhoto(file){if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPG·PNG·WebP 사진을 선택해 주세요.');if(!file.size || file.size>20*1024*1024)throw new Error('20MB 이하의 사진을 선택해 주세요.');}
export async function preparePhoto(file,maxEdge=1600){
  validatePhoto(file);
  const bitmap=await createImageBitmap(file);
  try{
    const scale=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.84));
    if(!blob || blob.size>5*1024*1024)throw new Error('사진을 처리하지 못했어요. 다른 사진을 선택해 주세요.');
    return new File([blob],'photo.webp',{type:'image/webp'});
  }finally{bitmap.close();}
}
export async function uploadMedia(db,userId,file){
  const photo=await preparePhoto(file),path=`${userId}/${crypto.randomUUID()}.webp`;
  const {error}=await db.storage.from('community-media').upload(path,photo,{contentType:photo.type,upsert:false});
  if(error)throw new Error('사진을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');return path;
}
