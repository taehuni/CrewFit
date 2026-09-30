import { useInfiniteQuery,useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORTS } from '../crews/crews.js';
import { detailDuration,groupExerciseSets } from '../activities/activityDetail.js';
import { attachmentChoices,ownAttachment,sharedAttachment } from './postActivities.js';

export function ActivityPicker({value,onChange,disabled}) {
  const {user}=useAuth();
  const list=useInfiniteQuery({queryKey:queryKeys.attachmentChoices(user.id),initialPageParam:null,
    queryFn:({pageParam})=>attachmentChoices(supabase,user.id,pageParam),getNextPageParam:page=>page.next,retry:false,gcTime:0});
  const selected=useQuery({queryKey:queryKeys.attachmentOwn(user.id,String(value)),queryFn:()=>ownAttachment(supabase,user.id,value),enabled:!!value,retry:false,gcTime:0});
  const rows=list.data?.pages.flatMap(page=>page.rows) || [];
  const options=selected.data && !rows.some(row=>String(row.id)===String(value))?[selected.data,...rows]:rows;
  return <section className="activity-picker"><label>내 운동 기록 · 선택<select value={value || ''} disabled={disabled} onChange={event=>{const row=options.find(item=>String(item.id)===event.target.value);onChange(row || null);}}>
    <option value="">첨부 안 함</option>{value && !options.some(row=>String(row.id)===String(value)) && <option value={value}>선택한 기록 확인 중</option>}
    {options.map(row=><option key={row.id} value={row.id}>{row.performed_on} · {SPORTS[row.sport]} · {detailDuration(row.duration_sec)}</option>)}</select></label>
    {list.isPending && <p role="status">내 기록을 불러오고 있어요.</p>}
    {(list.isError || selected.isError) && <div role="alert"><p>기록을 불러오지 못했어요. 삭제된 기록이면 첨부를 해제해 주세요.</p><button type="button" className="btn btn-ghost" disabled={disabled} onClick={()=>{list.refetch();if(value)selected.refetch();}}>기록 다시 조회</button></div>}
    {list.hasNextPage && <button type="button" className="btn btn-ghost" disabled={disabled || list.isFetching} onClick={()=>list.fetchNextPage()}>이전 기록 더 보기</button>}
    {value && <p className="feed-note">첨부하면 프로필의 기록 공개 설정과 별개로 이 글을 볼 수 있는 회원에게 해당 기록(메모·세트 포함)을 공유합니다. 원본 수정은 글에 반영되고 삭제하면 첨부가 해제됩니다. GPS 경로는 ‘GPS 경로도 공유하기’를 켤 때만 공유합니다.</p>}
  </section>;
}
export default function ActivityAttachment({postId}) {
  const {user}=useAuth();
  const query=useQuery({queryKey:queryKeys.postAttachment(user.id,String(postId)),queryFn:()=>sharedAttachment(supabase,postId),retry:false,staleTime:0,gcTime:0});
  if(query.isPending)return <p role="status">첨부 기록을 불러오고 있어요.</p>;
  if(query.isError)return <div role="alert"><p>{query.error.message}</p><button className="btn btn-ghost" onClick={()=>query.refetch()}>첨부 다시 조회</button></div>;
  if(!query.data)return <p>첨부 기록이 삭제되었거나 볼 수 없어요.</p>;
  const {activity,sets}=query.data;
  return <section className="post-activity" aria-label="첨부 운동 기록"><h2>{SPORTS[activity.sport]} 기록</h2><p>{activity.performed_on} · {detailDuration(activity.duration_sec)}{activity.distance_m!=null && ` · ${(activity.distance_m/1000).toLocaleString()} km`}</p>
    {groupExerciseSets(sets).map(group=><div key={group.name} className="post-exercise"><h3>{group.name}</h3><ul>{group.sets.map(set=><li key={set.id}>{set.set_no}세트 · {set.reps==null?'횟수 미입력':`${set.reps}회`} · {set.weight_kg==null?'중량 미입력':`${set.weight_kg} kg`}</li>)}</ul></div>)}
    {activity.sport==='gym' && !sets.length && <p>등록된 세트가 없어요.</p>}
  </section>;
}
