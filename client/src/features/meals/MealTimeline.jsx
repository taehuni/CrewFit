import { Link } from 'react-router';
import { MEAL_LABEL, visibleMealItems } from './mealRecord.js';
const symbols = { breakfast: '☀', lunch: '◒', dinner: '☾', snack: '✦' };
export default function MealTimeline({ items }) {
  const groups = new Map();
  for (const meal of items) {
    if (!groups.has(meal.eaten_on)) groups.set(meal.eaten_on, []);
    groups.get(meal.eaten_on).push(meal);
  }
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  return <div className="meal-timeline">{[...groups].map(([date, records]) => <section className="meal-day" key={date}>
    <header><time dateTime={date}>{date === today ? '오늘' : new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(date + 'T12:00:00+09:00'))}<small>{date.slice(0, 4)}년</small></time><span>{records.length}개 기록</span></header>
    <ul>{records.map(meal => {
      const foods = visibleMealItems(meal.items), known = foods.filter(food => food.kcal !== null);
      return <li key={meal.id}><Link className="meal-entry" to={'/meals/' + meal.id} data-meal={meal.meal_type}>
        <div className="meal-entry-heading"><span className="meal-entry-symbol" aria-hidden="true">{symbols[meal.meal_type] || '◒'}</span><div><small>먹은 기록</small><h3>{MEAL_LABEL[meal.meal_type] || '식사'}</h3></div><span className="meal-entry-arrow" aria-hidden="true">↗</span></div>
        <ul className="meal-entry-foods">{foods.slice(0, 3).map((food, i) => <li key={i}><strong>{food.name}</strong><span>{food.amount || '양 미입력'}</span></li>)}</ul>
        {foods.length > 3 && <p className="meal-entry-extra">외 {foods.length - 3}개 음식</p>}
        {!foods.length && <p className="meal-entry-extra">저장된 음식 없음</p>}
        {meal.note && <p className="meal-entry-note">{meal.note}</p>}
        <footer><span>{known.length ? <><strong>{known.reduce((sum, food) => sum + food.kcal, 0).toLocaleString('ko-KR')}</strong> kcal <small>· {known.length < foods.length ? '일부 음식 입력값' : '직접 입력값'}</small></> : '칼로리 미입력'}</span><span>자세히 보기</span></footer>
      </Link></li>;
    })}</ul>
  </section>)}</div>;
}
