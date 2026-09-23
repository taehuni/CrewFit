import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button, FormMessage } from '../../shared/ui.jsx';
import { MEAL_LABEL, visibleMealItems } from './mealRecord.js';
import './meals.css';

export default function MealDetailView({ detail, onDelete }) {
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), dialog = useRef(null); const meal = !detail.isPending && !detail.isError ? detail.data : null;
  const items = visibleMealItems(meal?.items), kcal = items.reduce((sum, item) => sum + (item.kcal ?? 0), 0), hasKcal = items.some(item => item.kcal != null);
  useEffect(() => {
    if (!confirming) return;
    dialog.current?.showModal();
    const preventBusyEscape = event => { if (event.key === 'Escape' && lock.current) event.preventDefault(); };
    window.addEventListener('keydown', preventBusyEscape, true);
    return () => window.removeEventListener('keydown', preventBusyEscape, true);
  }, [confirming]);
  async function remove() { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await onDelete(); } catch { setError('삭제 결과를 확인하지 못했어요. 목록을 새로 확인한 뒤 다시 시도해 주세요.'); } finally { lock.current = false; setBusy(false); } }
  return <article className="meal-detail"><header className="meal-detail-heading"><Link className="meal-back" to="/meals">식단 목록으로</Link><h1>{meal ? `${MEAL_LABEL[meal.meal_type] || '식사'} 기록` : '식단 기록 상세'}</h1>{meal && <time dateTime={meal.eaten_on}>{meal.eaten_on.replaceAll('-', '.')}</time>}
    {meal && <div className="meal-detail-actions"><Link className="btn btn-ghost" to={`/meals/${meal.id}/edit`}>수정</Link>{onDelete && <Button className="meal-delete-open" variant="ghost" onClick={() => { setConfirming(true); setError(''); }}>삭제</Button>}</div>}</header>
    {detail.isPending ? <p className="meal-state" role="status">식단 기록을 불러오고 있어요.</p>
      : detail.isError ? <div className="meal-state" role="alert"><p>식단 기록을 불러오지 못했어요.</p><Button variant="ghost" onClick={detail.refetch}>다시 불러오기</Button></div>
      : !meal ? <div className="meal-state"><h2>기록을 찾을 수 없어요.</h2><p>삭제되었거나 볼 수 없는 기록입니다.</p></div>
      : <><dl className="meal-detail-summary"><div><dt>끼니</dt><dd>{MEAL_LABEL[meal.meal_type]}</dd></div><div><dt>음식</dt><dd>{items.length}<small>개</small></dd></div>{hasKcal && <div><dt>입력한 칼로리 합계</dt><dd>{kcal.toLocaleString('ko-KR')}<small>kcal</small></dd></div>}</dl>
        <section className="meal-detail-items"><h2>먹은 음식</h2>{items.length ? <ul>{items.map((item, index) => <li key={index}><strong>{item.name}</strong><span>{item.amount || '양 미입력'}</span><span>{item.kcal == null ? '칼로리 미입력' : `${item.kcal.toLocaleString('ko-KR')} kcal`}</span></li>)}</ul> : <p className="meal-muted">저장된 음식이 없어요.</p>}</section>
        <section className="meal-detail-note"><h2>메모</h2><p className={!meal.note?.trim() ? 'meal-muted' : undefined}>{meal.note?.trim() || '남긴 메모가 없어요.'}</p></section></>}
    {confirming && <dialog ref={dialog} className="meal-delete-confirm" role="alertdialog" aria-labelledby="meal-delete-title"
      onCancel={event => { if (lock.current) event.preventDefault(); }} onClose={() => setConfirming(false)}>
      <h2 id="meal-delete-title">이 식단 기록을 삭제할까요?</h2><p>삭제한 기록은 되돌릴 수 없습니다.</p><FormMessage>{error}</FormMessage><div><Button variant="ghost" autoFocus disabled={busy} onClick={() => dialog.current?.close()}>취소</Button><Button className="meal-delete-button" disabled={busy} onClick={remove}>{busy ? '삭제 중…' : '삭제하기'}</Button></div>
    </dialog>}
  </article>;
}
