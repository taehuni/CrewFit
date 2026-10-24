import '../coach/coach-entry.css';
import FeedbackContent from './FeedbackContent.jsx';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { api } from '../../shared/api.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { supabase } from '../../shared/supabaseClient.js';
import { FEEDBACK_PERIODS, feedbackError, feedbackPeriodLabel, feedbackPeriodStart, loadSavedFeedback, kstToday } from './feedback.js';
import './feedback.css';
import FeedbackHistory from './FeedbackHistory.jsx';

function requestFeedback(token, period, date, force = false) {
  return api('/feedback/generate', { token, body: { period, date, force } });
}

export default function FeedbackPage() {
  const { user, token } = useAuth();
  const cache = useQueryClient();
  const [view,setView] = useState('result');
  const [period, setPeriod] = useState('week');
  const [date, setDate] = useState(() => kstToday());
  const key = queryKeys.feedback(user.id, period, feedbackPeriodStart(period, date));
  const inFlight = useRef(false);
  const feedback = useQuery({
    queryKey: key,
    queryFn: () => loadSavedFeedback(supabase, user.id, period, date),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  const generate = useMutation({
    mutationFn: ({ period, date, force }) => requestFeedback(token, period, date, force),
    retry: false,
    onSuccess: (data, variables) => {
      cache.setQueryData(variables.key, data);
      if (!data.cached) void cache.invalidateQueries({ queryKey: queryKeys.feedbackHistory(user.id) });
    },
  });
  async function request(force = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await cache.cancelQueries({ queryKey: key, exact: true });
      await generate.mutateAsync({ period, date, force, key });
    } catch { /* The mutation error is displayed below, preserving any saved result. */ }
    finally { inFlight.current = false; }
  }
  const result = feedback.data;
  const initialError = result ? null : (generate.error || feedback.error);
  const busy = generate.isPending;

  return (
    <div className="feedback-page">
      <header className="feedback-heading">
        <div>
          <p>기록을 읽고 다음 행동으로</p>
          <h1>나의 운동 리포트</h1>
        </div>
        <Link to="/coach" className="feedback-back">코칭 선택으로 →</Link>
      </header>

      <nav className="feedback-view-tabs" aria-label="기간별 코칭 화면"><button type="button" aria-pressed={view==='result'} onClick={()=>setView('result')}>기간별 코칭</button><button type="button" aria-pressed={view==='history'} onClick={()=>setView('history')}>지난 코칭</button></nav>
      <div hidden={view!=='result'}>
      <section className="feedback-control" aria-labelledby="feedback-period-title">
        <div>
          <h2 id="feedback-period-title">분석 기간</h2>
          <p>{feedbackPeriodLabel(period, date)}</p>
        </div>
        <div className="feedback-filters">
          <div className="feedback-periods" role="group" aria-label="분석 기간 단위">
            {FEEDBACK_PERIODS.map(item => (
              <button key={item.value} type="button" disabled={busy} aria-pressed={period === item.value}
                onClick={() => { setPeriod(item.value); generate.reset(); }}>{item.label}</button>
            ))}
          </div>
          <label className="feedback-date"><span>기준 날짜</span><input type="date" disabled={busy} value={date} max={kstToday()}
            onChange={event => { if (event.target.value) setDate(event.target.value); generate.reset(); }} /></label>
        </div>
      </section>

      <div className="feedback-actions">
        <p>기간 선택은 조회만 해요. 버튼을 눌러야 AI가 분석해요.</p>
        <button type="button" className="btn btn-primary" disabled={busy || feedback.isFetching || !!feedback.error}
          onClick={() => request()}>{busy ? '분석 중…' : result ? '현재 기록으로 리포트 만들기' : '리포트 만들기'}</button>
      </div>
      {result && feedback.error && <div className="feedback-state-error" role="alert">
        <p>저장된 결과를 다시 확인하지 못했어요. 화면에는 이전 조회 결과를 유지했어요.</p>
        <button type="button" className="btn btn-ghost" disabled={feedback.isFetching} onClick={() => feedback.refetch()}>저장된 결과 다시 조회</button>
      </div>}
      <section className="feedback-result" aria-labelledby="feedback-result-title" aria-busy={feedback.isFetching || busy}>
        <div className="feedback-result-head">
          <div>
            <span className="feedback-signal" aria-hidden="true">CF</span>
            <div><h2 id="feedback-result-title">이번 기간 리포트</h2>{result && <p>{result.cached ? '저장된 분석' : '새 분석'} · {new Date(result.created_at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}</p>}</div>
          </div>
          {result && <span className="feedback-model">AI 생성 내용</span>}
        </div>

        {feedback.isPending ? <div className="feedback-state" role="status"><strong>저장된 피드백을 확인하고 있어요.</strong></div>
          : busy && !result ? <div className="feedback-state" role="status"><strong>기록을 분석하고 있어요.</strong><span>운동·식단·목표를 함께 읽는 데 잠시 걸릴 수 있어요.</span></div>
          : initialError ? <div className="feedback-state feedback-state-error" role="alert"><strong>{feedbackError(initialError)}</strong><span>입력한 기록은 변경되지 않았어요.</span>{feedback.error && <button type="button" className="btn btn-ghost" onClick={() => feedback.refetch()}>저장된 결과 다시 조회</button>}</div>
          : result ? <FeedbackContent content={result.content} report={result.report}/>
          : <div className="feedback-state"><strong>이 기간의 피드백을 받아보세요.</strong><span>운동·식단·목표 기록을 바탕으로 다음 운동에서 할 행동을 제안해요.</span></div>}
      </section>

      {result && <section className="feedback-plan-bridge"><div><h3>추천을 내 일정으로 이어가볼까요?</h3><p>가능한 날짜와 시간을 확인해 운동 계획으로 제안해요. 제안을 확인한 뒤 내 계획에 저장할 수 있어요.</p></div><Link className="btn btn-primary" to="/coach?view=chat" state={{coachPrompt:`이 피드백을 참고해서 다음 운동 계획을 함께 만들고 싶어요. 가능한 날짜·요일과 시간을 먼저 물어봐 주세요. 피드백 안의 제약과 특이사항을 고려하고 제가 확인하기 전에는 저장했다고 말하지 마세요.\n참고 피드백:\n${result.content.slice(0,1400)}`}}>추천으로 계획 상담하기 →</Link></section>}
      {result && <footer className="feedback-actions">
        <div><p>작성 시점의 분석이에요. 현재 기록으로 요청해도 내용이 같으면 기존 결과를 사용해요.</p>{generate.error && <p className="feedback-regenerate-error" role="alert">{feedbackError(generate.error)} 기존 코칭은 그대로 유지했어요.</p>}</div>
        <button type="button" className="btn btn-ghost" disabled={busy || feedback.isFetching || !!feedback.error || result.remaining_regenerations === 0}
          onClick={() => request(true)}>{`다시 받기 · ${result.remaining_regenerations}회 남음`}</button>
      </footer>}
      </div><div hidden={view!=='history'}><FeedbackHistory /></div>
      <p className="feedback-caution">AI 코칭은 의료 진단이 아닙니다. 통증이나 건강 문제는 전문가와 상담하세요.</p>
    </div>
  );
}
