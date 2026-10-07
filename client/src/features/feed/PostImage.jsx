import { useState,useRef,useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { signPostImages } from './postImages.js';

export function usePostImages(paths) {
  const {user}=useAuth();
  const unique=[...new Set(paths.filter(Boolean))].sort();
  return useQuery({queryKey:queryKeys.postImages(user.id,unique),queryFn:()=>signPostImages(supabase,unique),
    enabled:unique.length>0,retry:false,staleTime:0,gcTime:0,refetchInterval:50*60*1000});
}
export function PostImage({url,loading,onRetry}) {
  const [failed,setFailed]=useState(false);
  const dialog=useRef(null);
  useEffect(()=>{const element=dialog.current;return()=>{if(element?.open)element.close();};},[]);
  return url && !failed ? <><button type="button" className="post-image-button" aria-label="첨부 사진 크게 보기" onClick={()=>dialog.current?.showModal()}><img className="post-image" src={url} alt="글에 첨부된 사진" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/><span className="photo-expand-label">사진 크게 보기 ↗</span></button><dialog ref={dialog} className="photo-dialog" aria-label="첨부 사진 확대" onClick={e=>{if(e.target===dialog.current)dialog.current.close();}}><button type="button" className="photo-dialog-close" onClick={()=>dialog.current.close()} autoFocus>닫기 ×</button><img src={url} alt="글에 첨부된 사진 확대" referrerPolicy="no-referrer"/></dialog></> :
    <div className="post-image-state">{loading?<p role="status">사진을 불러오고 있어요.</p>:<><p>사진을 불러오지 못했어요.</p><button type="button" className="btn btn-ghost" onClick={()=>{setFailed(false);onRetry();}}>사진 다시 불러오기</button></>}</div>;
}
export default function StoredPostImage({path}) {
  const images=usePostImages([path]);
  return <PostImage key={images.data?.[path] || path} url={images.data?.[path]} loading={images.isFetching} onRetry={()=>images.refetch()}/>;
}
