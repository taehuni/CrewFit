import { useRef } from 'react';
import { Link } from 'react-router';
import { Button } from '../../shared/ui.jsx';
import RecordTabs from '../../shared/RecordTabs.jsx';
import { MEAL_LABEL, visibleMealItems } from './mealRecord.js';
import './meals.css';

export default function MealListView({ meals }) {
  const items = meals.data?.pages.flatMap(page => page.items) || [];
  const nextLock = useRef(false);
  async function more() {
    if (nextLock.current || meals.isFetching) return;
    nextLock.current = true;
    try { await meals.fetchNextPage(); } finally { nextLock.current = false; }
  }
  return <div className="meal-library">
    <RecordTabs active="meals" />
    <header className="meal-library-heading"><div><h1>식단 기록</h1><p>날짜순으로 모아 보는 내 식사</p></div><Link className="btn btn-primary" to="/meals/new">＋ 식단 기록하기</Link></header>
    <section className="meal-library-results" aria-label="식단 기록 목록" aria-busy={meals.isFetching}>
      <div className="meal-library-caption"><span>최신 날짜순</span><span role="status">{meals.data ? `${items.length}건 표시${meals.hasNextPage ? ' · 더 있음' : ''}` : ''}</span></div>
      {meals.isPending ? <p className="meal-state" role="status">식단 기록을 불러오고 있어요.</p>
        : !meals.data && meals.isError ? <div className="meal-state" role="alert"><p>식단 기록을 불러오지 못했어요.</p><Button variant="ghost" onClick={() => meals.refetch()}>다시 불러오기</Button></div>
        : <>{items.length ? <ul className="meal-library-list">{items.map(meal => {
          const foods = visibleMealItems(meal.items), kcal = foods.reduce((sum, item) => sum + (item.kcal ?? 0), 0), hasKcal = foods.some(item => item.kcal != null);
          return <li key={meal.id}><Link className="meal-library-row" to={'/meals/' + meal.id}>
            <time dateTime={meal.eaten_on}>{meal.eaten_on.replaceAll('-', '.')}</time>
            <div className="meal-library-name"><strong>{MEAL_LABEL[meal.meal_type] || '식사'}</strong><p>{foods.length ? foods.map(item => item.name).join(' · ') : '저장된 음식 없음'}</p></div>
            <div className="meal-library-meta"><span>{foods.length}<small>개 음식</small></span>{hasKcal && <span>{kcal.toLocaleString('ko-KR')}<small>kcal</small></span>}</div><span className="meal-chevron" aria-hidden="true">›</span>
          </Link></li>;
        })}</ul> : <div className="meal-state"><h2>아직 식단 기록이 없어요.</h2><p>먹은 음식을 간단히 남기면 AI 피드백에 함께 반영할 수 있어요.</p><Link className="btn btn-ghost" to="/meals/new">첫 식단 기록하기</Link></div>}
          {meals.isError && meals.data && <div className="meal-state" role="alert"><p>다음 기록을 불러오지 못했어요. 현재 목록은 유지됩니다.</p><Button variant="ghost" disabled={meals.isFetching} onClick={more}>다시 불러오기</Button></div>}
          {meals.hasNextPage && !meals.isFetchNextPageError && <Button className="meal-more" variant="ghost" disabled={meals.isFetching} onClick={more}>{meals.isFetchingNextPage ? '불러오는 중…' : '더 보기'}</Button>}
        </>}
    </section>
  </div>;
}
