import {useState} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';
import {api} from '../../shared/api.js';
import {useAuth} from '../auth/index.js';
export default function CoachHistory({onSelect,active}) {
 const {user,token}=useAuth();
 const [draft,setDraft]=useState({q:'',date:''}),[filter,setFilter]=useState({q:'',date:''});
 const result=useInfiniteQuery({queryKey:['coach-history',user.id,filter],initialPageParam:null,
  queryFn:({pageParam,signal})=>{const qs=new URLSearchParams(filter);if(pageParam)qs.set('cursor',pageParam);return api('/coach/history?'+qs,{token,signal});},
  getNextPageParam:last=>last.nextCursor||undefined,retry:false,enabled:active});
 const rows=result.data?.pages.flatMap(page=>page.turns.map(turn=>({turn,plans:page.plans})))||[];
 return <section className="coach-archive" aria-label="지난 코칭 찾기"><form className="coach-archive-search" onSubmit={e=>{e.preventDefault();setFilter({...draft,q:draft.q.trim()});}}>
 <label className="archive-keyword">대화 내용<input type="search" placeholder="질문이나 답변의 단어 검색" maxLength={100} value={draft.q} onChange={e=>setDraft(old=>({...old,q:e.target.value}))}/></label>
 <label>대화한 날짜<input type="date" value={draft.date} onChange={e=>setDraft(old=>({...old,date:e.target.value}))}/></label>
 <button className="btn btn-primary" type="submit">검색</button><button className="btn btn-ghost" type="button" onClick={()=>{setDraft({q:'',date:''});setFilter({q:'',date:''});}}>초기화</button></form>
 <div className="coach-archive-results" aria-live="polite">
 <p className="archive-caption">{filter.q||filter.date?'검색 결과':'최근 대화부터'} · {rows.length}개{result.hasNextPage?' 이상':''}</p>
 {result.isPending&&<p role="status">대화를 찾고 있어요…</p>}
 {result.isError&&<div role="alert"><p>{result.error.message}</p><button type="button" className="btn btn-ghost" onClick={()=>result.refetch()}>다시 시도</button></div>}
 {result.isSuccess&&!rows.length&&<div className="archive-empty"><strong>찾은 대화가 없어요</strong><p>다른 단어로 검색하거나 날짜를 비워 보세요.</p></div>}
 {rows.map(({turn,plans})=>{const starter=turn.message.startsWith('처음 운동을 시작하려고 해요.');const title=starter?`${turn.message.match(/(1|2|4)주 입문 계획/)?.[0]||'입문 계획'} · ${turn.message.match(/하고 싶은 운동: (.+)/)?.[1]||'운동'}`:turn.message;return <button type="button" className="archive-result" key={turn.id} onClick={()=>onSelect(turn,plans)}><span className="archive-result-meta"><time dateTime={turn.created_at}>{new Date(turn.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time><span>대화 보기 ↗</span></span><strong>{title}</strong><p>{turn.answer.replace(/\\n/g,' ')}</p><small>{turn.proposals?.length?`운동 제안 ${turn.proposals.length}개`:''}{turn.meal_proposals?.length?` · 식단 제안 ${turn.meal_proposals.length}개`:''}</small></button>})}
 {result.hasNextPage&&<button type="button" className="btn btn-ghost archive-more" disabled={result.isFetchingNextPage} onClick={()=>result.fetchNextPage()}>{result.isFetchingNextPage?'불러오는 중…':'이전 대화 더 보기'}</button>}
 </div></section>;
}
