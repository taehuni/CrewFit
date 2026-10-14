import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '../../shared/ui.jsx';
import RecordTabs from '../../shared/RecordTabs.jsx';
import MealTimeline from './MealTimeline.jsx';
import { SavedMealPlans } from '../coach/NutritionCoach.jsx';
import './meal-journal.css';
import './meals.css';

export default function MealListView({ meals }) {
  const [params] = useSearchParams();
  const showPlans = params.get('view') === 'plans';
  const items = meals.data?.pages.flatMap(page => page.items) || [];
  const nextLock = useRef(false);
  async function more() {
    if (nextLock.current || meals.isFetching) return;
    nextLock.current = true;
    try { await meals.fetchNextPage(); } finally { nextLock.current = false; }
  }
  return <div className="meal-library meal-journal">
    <RecordTabs active="meals" />
    <header className="meal-journal-hero"><span className="section-eyebrow">나의 식사 노트</span><h1>하루 한 끼씩, 나를 돌보는 기록</h1><p>잘 먹은 날도, 간단히 챙긴 날도 괜찮아요.<br/>먹은 음식과 작은 메모로 나만의 식사 습관을 모아 보세요.</p><Link className="btn btn-primary" to="/meals/new">＋ 먹은 식사 기록하기</Link></header>
    <nav className="meal-journal-switch" aria-label="식단 보기"><Link to="/meals" aria-current={!showPlans?'page':undefined}>먹은 기록</Link><Link to="/meals?view=plans" aria-current={showPlans?'page':undefined}>저장한 식단 계획</Link></nav>
    {showPlans ? <><section className="meal-coach-invite" aria-labelledby="meal-coach-title"><span className="meal-coach-symbol" aria-hidden="true">AI</span><div><h2 id="meal-coach-title">다음 한 끼가 고민이라면</h2><p>취향과 준비 시간에 맞는 식단을 코치와 찾아보세요.</p></div><Link to="/coach" state={{coachPrompt:"내 식사 선호에 맞는 다음 한 끼를 추천해줘."}}>식단 추천받기 <span aria-hidden="true">→</span></Link></section><SavedMealPlans/></> : <>
    <section className="meal-library-results" aria-label="식단 기록 목록" aria-busy={meals.isFetching}>
      <div className="meal-library-caption"><span>최신 날짜순</span><span role="status">{meals.data ? `${items.length}건 표시${meals.hasNextPage ? ' · 더 있음' : ''}` : ''}</span></div>
      {meals.isPending ? <p className="meal-state" role="status">식단 기록을 불러오고 있어요.</p>
        : !meals.data && meals.isError ? <div className="meal-state" role="alert"><p>식단 기록을 불러오지 못했어요.</p><Button variant="ghost" onClick={() => meals.refetch()}>다시 불러오기</Button></div>
        : <>{items.length ? <MealTimeline items={items} /> : <div className="meal-state"><h2>아직 식단 기록이 없어요.</h2><p>먹은 음식을 간단히 남기면 AI 피드백에 함께 반영할 수 있어요.</p><Link className="btn btn-ghost" to="/meals/new">첫 식단 기록하기</Link></div>}
          {meals.isError && meals.data && <div className="meal-state" role="alert"><p>다음 기록을 불러오지 못했어요. 현재 목록은 유지됩니다.</p><Button variant="ghost" disabled={meals.isFetching} onClick={more}>다시 불러오기</Button></div>}
          {meals.hasNextPage && !meals.isFetchNextPageError && <Button className="meal-more" variant="ghost" disabled={meals.isFetching} onClick={more}>{meals.isFetchingNextPage ? '불러오는 중…' : '더 보기'}</Button>}
        </>}
    </section></>}
  </div>;
}
