import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button, FormMessage } from '../../shared/ui.jsx';
import ExerciseNameInput from './ExerciseNameInput.jsx';
import { exerciseMergePreview } from './exerciseMerge.js';
import './exercise-merge.css';

export default function ExerciseNamesView({ catalog, onMerge, returnTo = '/activities' }) {
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [preview, setPreview] = useState(null), [error, setError] = useState('');
  const [success, setSuccess] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false), confirmation = useRef(null), sourceInput = useRef(null);
  const names = catalog.data || [];
  useEffect(() => { if (preview) confirmation.current?.focus(); }, [preview]);
  function review(event) {
    event.preventDefault();
    setError(''); setSuccess('');
    try { setPreview(exerciseMergePreview(names, from, to)); }
    catch (failure) { setError(failure.message); }
  }
  function cancel() {
    if (lock.current) return;
    setPreview(null); setError('');
    requestAnimationFrame(() => sourceInput.current?.focus());
  }
  async function apply() {
    if (lock.current || !preview) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await onMerge({ from: preview.from, to: preview.to });
      setSuccess(`${result.updated}개 세트의 이름을 ‘${preview.to}’로 통일했어요.`);
      setFrom(''); setTo(''); setPreview(null);
      requestAnimationFrame(() => sourceInput.current?.focus());
    } catch (failure) {
      const known = ['CONFLICT', 'NOT_FOUND', 'INVALID_NAMES', 'FORBIDDEN', 'MIGRATION_REQUIRED'].includes(failure.code);
      setError(known ? failure.message : '변경 결과를 확인하지 못했어요. 재시도 전에 목록을 새로 조회해 변경 여부를 확인해 주세요.');
    } finally {
      lock.current = false; setBusy(false);
    }
  }
  return <div className="exercise-manager">
    <header className="exercise-manager-heading"><Link to={returnTo}>운동 기록으로</Link><h1>운동 이름 정리</h1><p>다르게 적었던 이름을 하나로 통일합니다. 중량·횟수·날짜는 그대로 유지돼요.</p></header>
    <FormMessage tone="ok">{success}</FormMessage>
    {catalog.isPending ? <p className="exercise-manager-state" role="status">내 운동 이름을 불러오고 있어요.</p>
      : catalog.isError ? <div className="exercise-manager-state" role="alert"><p>최신 운동 이름을 불러오지 못했어요.</p><Button variant="ghost" onClick={() => catalog.refetch()}>다시 불러오기</Button></div>
      : !names.length ? <div className="exercise-manager-state"><h2>아직 헬스 기록이 없어요.</h2><p>헬스 기록을 저장하면 사용한 운동 이름을 정리할 수 있어요.</p><Link className="btn btn-ghost" to="/activities/new?sport=gym">헬스 기록하기</Link></div>
      : <section className="exercise-manager-panel" aria-label="운동 이름 변경">
        {!preview ? <form onSubmit={review} noValidate>
          <div className="field"><label htmlFor="exercise-from">기존 이름</label>
            <select ref={sourceInput} id="exercise-from" value={from} onChange={event => { setFrom(event.target.value); setError(''); }} required>
              <option value="">정리할 이름 선택</option>
              {names.map(item => <option key={item.name.toLowerCase()} value={item.name}>{item.name} · {item.activityCount}개 기록 / {item.setCount}세트</option>)}
            </select>
          </div>
          <ExerciseNameInput id="exercise-to" label="통일할 이름" value={to} onChange={setTo} history={names.map(item => item.name)} />
          <p className="exercise-manager-hint">기존 이름을 추천에서 선택하거나 새 이름을 직접 입력하세요.</p>
          <FormMessage>{error}</FormMessage>
          <Button type="submit">변경 내용 확인</Button>
        </form> : <div className="exercise-merge-confirm" aria-labelledby="merge-confirm-title">
          <h2 ref={confirmation} tabIndex={-1} id="merge-confirm-title">이 이름으로 통일할까요?</h2>
          <dl className="exercise-merge-names"><div><dt>기존 이름</dt><dd>{preview.from}</dd></div><div><dt>통일할 이름</dt><dd>{preview.to}</dd></div></dl>
          <p><strong>{preview.activityCount}개 운동 기록 · {preview.setCount}개 세트</strong>가 변경 대상입니다.</p>
          <p className="exercise-manager-hint">건수는 조회 시점 기준입니다. 실행할 때 이 이름을 쓰는 내 모든 기록에 적용합니다.</p>
          <p className="exercise-merge-warning">이름을 합친 뒤에는 원래 이름별로 되돌릴 수 없어요. 같은 기록에서 세트 번호가 겹치면 전체 변경을 취소합니다.</p>
          <FormMessage>{error}</FormMessage>
          <div className="exercise-merge-actions"><Button disabled={busy} onClick={apply}>{busy ? '변경 중…' : '이름 통일하기'}</Button><Button variant="ghost" disabled={busy} onClick={cancel}>취소</Button></div>
          {error && <Button className="exercise-merge-refresh" variant="ghost" disabled={busy} onClick={() => { cancel(); catalog.refetch(); }}>목록 새로 조회</Button>}
        </div>}
      </section>}
  </div>;
}
