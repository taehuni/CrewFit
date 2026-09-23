import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button, Field, FormMessage, SPORT_LABEL } from '../../shared/ui.jsx';
import { emptyGoal, goalForm, goalNumber, goalPayload, goalUnit, GOAL_PERIODS, GOAL_SPORTS, GOAL_TYPES } from './goals.js';
import './goals.css';

export default function GoalsView({ goals, onSave, onChange }) {
  const [editor, setEditor] = useState(null), [form, setForm] = useState(emptyGoal);
  const [removing, setRemoving] = useState(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [success, setSuccess] = useState('');
  const lock = useRef(false), editorTitle = useRef(null), deleteTitle = useRef(null), addButton = useRef(null);
  useEffect(() => { if (editor != null) editorTitle.current?.focus(); }, [editor]);
  useEffect(() => { if (removing != null) deleteTitle.current?.focus(); }, [removing]);
  const rows = goals.data || [];
  function open(goal = null) {
    setEditor(goal?.id ?? 'new'); setForm(goal ? goalForm(goal) : emptyGoal());
    setRemoving(null); setError(''); setSuccess('');
  }
  function close() {
    if (lock.current) return;
    setEditor(null); setRemoving(null); setError('');
    requestAnimationFrame(() => addButton.current?.focus());
  }
  async function perform(action, message) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      await action(); setSuccess(message); setEditor(null); setRemoving(null);
      requestAnimationFrame(() => addButton.current?.focus());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '변경 결과를 확인하지 못했어요. 목록을 다시 불러와 확인한 뒤 재시도해 주세요.');
    } finally { lock.current = false; setBusy(false); }
  }
  function submit(event) {
    event.preventDefault();
    try { goalPayload(form); } catch (failure) { setError(failure.message); return; }
    perform(() => onSave(form, editor === 'new' ? null : editor), editor === 'new' ? '목표를 추가했어요. 홈에서 달성률을 확인하세요.' : '목표를 수정했어요.');
  }
  return <div className="goals-page">
    <header className="goals-heading"><div><Link className="goals-back" to="/home">내 운동으로</Link><h1>목표 관리</h1></div>
      <button ref={addButton} className="btn btn-primary" type="button" disabled={busy || goals.isPending || goals.isError} onClick={() => open()}>＋ 목표 추가</button></header>
    <p className="goals-description">매주 또는 매월 반복하는 목표입니다. 해당 기간에 이미 저장한 기록도 달성률에 포함됩니다.</p>
    <FormMessage tone="ok">{success}</FormMessage>
    {editor == null && <FormMessage>{error}</FormMessage>}
    {editor != null && <form className="goal-editor" onSubmit={submit} noValidate>
      <h2 ref={editorTitle} tabIndex={-1}>{editor === 'new' ? '목표 추가' : '목표 수정'}</h2>
      <fieldset disabled={busy}>
        <div className="goal-form-grid">
          <div className="field"><label htmlFor="goal-period">반복 기간</label><select id="goal-period" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })}>{Object.entries(GOAL_PERIODS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <div className="field"><label htmlFor="goal-sport">종목</label><select id="goal-sport" value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })}><option value="">전체 종목</option>{GOAL_SPORTS.map(sport => <option key={sport} value={sport}>{SPORT_LABEL[sport]}</option>)}</select></div>
          <div className="field"><label htmlFor="goal-type">목표 종류</label><select id="goal-type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value, target: '' })}>{Object.entries(GOAL_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <Field id="goal-target" label={`목표 값 (${goalUnit(form)})`} inputMode={form.type === 'count' ? 'numeric' : 'decimal'} value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} required />
        </div>
        <p className="goal-hint">{form.type === 'count' ? '횟수는 운동한 날짜 수가 아니라 저장한 운동 기록 건수입니다.' : form.type === 'distance' ? '거리가 입력된 기록만 합산합니다. 500m는 0.5km로 입력하세요.' : '분 단위로 입력하세요. 1시간은 60분입니다.'}</p>
        <FormMessage>{error}</FormMessage>
        <div className="goal-actions"><Button type="submit" disabled={busy}>{busy ? '저장 중…' : '목표 저장'}</Button><Button variant="ghost" disabled={busy} onClick={close}>취소</Button></div>
      </fieldset>
    </form>}
    {goals.isPending ? <p className="goal-state" role="status">목표를 불러오고 있어요.</p>
      : goals.isError ? <div className="goal-state" role="alert"><p>목표 목록을 불러오지 못했어요.</p><Button variant="ghost" disabled={busy} onClick={() => goals.refetch()}>다시 불러오기</Button></div>
      : !rows.length ? <p className="goal-state">아직 목표가 없어요. ‘매주 운동 3회’부터 설정해 보세요.</p>
      : <ul className="goal-management-list">{rows.map(goal => <li key={goal.id}>
        <div className="goal-management-row"><div className="goal-summary"><span className="goal-frequency">{GOAL_PERIODS[goal.period]} · {SPORT_LABEL[goal.sport] || '전체 종목'}{!goal.is_active && ' · 일시 중지'}</span><h2>{GOAL_TYPES[goal.type]} <strong>{goalNumber(goal.target, goal)}</strong> {goalUnit(goal)}</h2></div>
          <div className="goal-actions"><Button variant="ghost" disabled={busy} onClick={() => open(goal)}>수정</Button><Button variant="ghost" disabled={busy || editor != null || removing != null} onClick={() => perform(() => onChange(goal.id, !goal.is_active), goal.is_active ? '목표를 일시 중지했어요.' : '목표를 다시 시작했어요.')}>{goal.is_active ? '일시 중지' : '다시 시작'}</Button><Button variant="ghost" disabled={busy || editor != null} onClick={() => { setRemoving(goal.id); setError(''); setSuccess(''); }}>삭제</Button></div></div>
        {removing === goal.id && <div className="goal-delete-confirm"><h3 tabIndex={-1} ref={deleteTitle}>이 목표를 삭제할까요?</h3><p>목표만 삭제합니다. 운동 기록은 그대로 남습니다.</p><div className="goal-actions"><Button disabled={busy} onClick={() => perform(() => onChange(goal.id, null), '목표를 삭제했어요.')}>{busy ? '삭제 중…' : '목표 삭제'}</Button><Button variant="ghost" disabled={busy} onClick={close}>취소</Button></div></div>}
      </li>)}</ul>}
    <p className="goal-hint">주간은 월요일~일요일, 월간은 매월 1일~말일이며 한국 시간 기준입니다. 수정한 목표는 현재 기간에도 바로 적용됩니다.</p>
  </div>;
}
