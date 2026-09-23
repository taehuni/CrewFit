import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { FEEDBACK_PERIODS, feedbackPeriodLabel, loadFeedbackHistory } from './feedback.js';

export default function FeedbackHistory() {
  const { user } = useAuth();
  const history = useInfiniteQuery({
    queryKey: queryKeys.feedbackHistory(user.id), initialPageParam: null,
    queryFn: ({ pageParam }) => loadFeedbackHistory(supabase, user.id, pageParam),
    getNextPageParam: page => page.nextCursor, retry: false,
  });
  const rows = history.data?.pages.flatMap(page => page.rows) || [];
  return <section className="feedback-history" aria-labelledby="feedback-history-title">
    <h2 id="feedback-history-title">지난 코칭</h2>
    <p>분석 기간과 받은 날짜를 확인하고, 코칭을 펼쳐 다시 읽어보세요.</p>
    {history.isPending && <p role="status">코칭 이력을 불러오고 있어요.</p>}
    {history.error && <div role="alert"><p>코칭 이력을 불러오지 못했어요. 처음 설정하는 경우 이력 SQL 적용을 확인해 주세요.</p>
      <button className="btn btn-ghost" disabled={history.isFetching} onClick={() => history.isFetchNextPageError ? history.fetchNextPage() : history.refetch()}>다시 조회</button></div>}
    {!history.isPending && !history.error && !rows.length && <p>아직 받은 코칭이 없어요. 위에서 첫 피드백을 받아보세요.</p>}
    {rows.map(row => <details key={row.id} className="feedback-history-item">
      <summary>
        <strong>{FEEDBACK_PERIODS.find(item => item.value === row.period)?.label} · {row.period_start.slice(0, 4)} · {feedbackPeriodLabel(row.period, row.period_start)}</strong>
        <time dateTime={row.created_at}>받은 날짜 · {new Date(row.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })}</time>
        <span className="feedback-history-preview">{row.content.slice(0, 100)}</span>
        <span className="feedback-history-toggle">코칭 펼치기 / 접기</span>
      </summary>
      <div className="feedback-history-content">{row.content}</div>
    </details>)}
    {history.hasNextPage && <button type="button" className="btn btn-ghost" disabled={history.isFetching}
      onClick={() => history.fetchNextPage()}>{history.isFetchingNextPage ? '불러오는 중…' : '이전 코칭 더 보기'}</button>}
  </section>;
}
