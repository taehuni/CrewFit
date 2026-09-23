import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button, Field, FormMessage } from '../../shared/ui.jsx';
import { emptyMealItem, MEAL_LABEL, MEAL_TYPES, mealPayload } from './mealRecord.js';
import './meals.css';

export default function MealForm({ today, initialValues, editing = false, onSave, cancelTo = '/meals' }) {
  const [form, setForm] = useState(() => initialValues || { date: today, type: 'breakfast', items: [emptyMealItem()], note: '' });
  const [errors, setErrors] = useState({}), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false), formRef = useRef(null);
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const changeItem = (index, key, value) => setForm(previous => ({ ...previous, items: previous.items.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const result = mealPayload(form);
    setErrors(result.errors); setMessage('');
    if (Object.keys(result.errors).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    lock.current = true; setBusy(true);
    try { await onSave(result.meal); }
    catch (failure) { setMessage(failure?.code === 'not_found' ? '기록이 삭제되었거나 수정할 수 없어요. 입력 내용은 유지됩니다.' : '저장 결과를 확인하지 못했어요. 입력 내용은 유지됩니다. 연결 상태를 확인하고 다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="meal-form-page">
    <header className="meal-form-heading"><Link to={cancelTo}>{editing ? '식단 상세로' : '식단 목록으로'}</Link><h1>{editing ? '식단 기록 수정' : '식단 기록하기'}</h1></header>
    <form ref={formRef} onSubmit={submit} noValidate><fieldset disabled={busy} className="meal-fields"><legend className="sr-only">식단 기록</legend>
      <div className="meal-basics"><Field id="meal-date" label="식사 날짜" type="date" required min="1900-01-01" max="9999-12-24" value={form.date} onChange={e => change('date', e.target.value)} error={errors.date} />
        <fieldset className="meal-types"><legend>끼니</legend>{MEAL_TYPES.map(type => <label key={type} data-selected={form.type === type}><input type="radio" name="meal-type" checked={form.type === type} onChange={() => change('type', type)} />{MEAL_LABEL[type]}</label>)}</fieldset></div>
      <section className="meal-items" aria-labelledby="meal-items-title"><div className="meal-items-head"><h2 id="meal-items-title">먹은 음식</h2><span>최대 30개</span></div>
        {form.items.map((item, index) => <fieldset className="meal-item" key={index}><legend>음식 {index + 1}</legend>
          <Field id={'meal-name-' + index} label="음식 이름" required maxLength="100" placeholder="현미밥" value={item.name} onChange={e => changeItem(index, 'name', e.target.value)} error={errors['name-' + index]} />
          <Field id={'meal-amount-' + index} label="양 (선택)" maxLength="100" placeholder="1공기 · 200g" value={item.amount} onChange={e => changeItem(index, 'amount', e.target.value)} error={errors['amount-' + index]} />
          <Field id={'meal-kcal-' + index} label="칼로리 (선택)" type="number" inputMode="numeric" min="0" max="100000" step="1" placeholder="300" value={item.kcal} onChange={e => changeItem(index, 'kcal', e.target.value)} error={errors['kcal-' + index]} />
          <Button variant="ghost" aria-label={'음식 ' + (index + 1) + ' 삭제'} disabled={form.items.length === 1} onClick={() => { change('items', form.items.filter((_, i) => i !== index)); setErrors({}); }}>삭제</Button>
        </fieldset>)}
        {errors.items && <FormMessage>{errors.items}</FormMessage>}
        <Button variant="ghost" disabled={form.items.length >= 30} onClick={() => change('items', [...form.items, emptyMealItem()])}>＋ 음식 추가</Button>
      </section>
      <div className="field"><label htmlFor="meal-note">메모 <span className="meal-optional">선택</span></label><textarea id="meal-note" rows="4" maxLength="1000" placeholder="식사 후 느낌이나 남겨둘 내용" value={form.note} onChange={e => change('note', e.target.value)} aria-invalid={errors.note ? true : undefined} aria-describedby={errors.note ? 'meal-note-error' : undefined} />{errors.note && <p id="meal-note-error" className="field-error">{errors.note}</p>}</div>
      <FormMessage>{message}</FormMessage><div className="meal-actions"><Button type="submit" disabled={busy}>{busy ? '저장 중…' : editing ? '수정 저장하기' : '식단 저장하기'}</Button>{!busy && <Link to={cancelTo}>취소</Link>}</div>
    </fieldset></form>
  </div>;
}
