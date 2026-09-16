import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Button, Field, FormMessage, SPORT_LABEL } from '../../shared/ui.jsx';
import { activityPayload } from './record.js';
import { ACTIVITY_SPORTS, distanceUnit, hasDistance, initialActivitySport } from './sports.js';
import ExerciseNameInput from './ExerciseNameInput.jsx';
import './activities.css';

const emptySet = () => ({ name: '', reps: '', weight: '' });

export default function ActivityForm({ today, onSave, initialSport = 'running', initialValues, editing = false, cancelTo = '/home',
  exerciseNames = [], exerciseNamesPending = false, exerciseNamesError = false, onExerciseNameFocus, onExerciseNamesRetry }) {
  const location = useLocation();
  const [form, setForm] = useState(() => initialValues || { sport: initialActivitySport(initialSport), date: today, minutes: '', seconds: '0', distance: '', lapCount: '', note: '', sets: [emptySet()] });
  const [sportDistances, setSportDistances] = useState({});
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const formRef = useRef(null);
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const changeSet = (index, key, value) => setForm(previous => ({ ...previous, sets: previous.sets.map((row, i) => i === index ? { ...row, [key]: value } : row) }));
  function changeSport(sport) {
    setSportDistances(previous => ({ ...previous, [form.sport]: form.distance }));
    setForm(previous => ({ ...previous, sport, distance: sportDistances[sport] ?? '' }));
    setErrors({});
    setMessage('');
  }
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const payload = activityPayload(form, { editing });
    setErrors(payload.errors);
    setMessage('');
    if (Object.keys(payload.errors).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await onSave(payload);
    } catch (error) {
      setMessage(editing
        ? error.code === 'PGRST202' ? '헬스 수정용 DB 함수가 아직 적용되지 않았어요. 20260914_update_gym_activity.sql 적용이 필요합니다. 입력 내용은 유지됩니다.'
          : error.code === 'not_found' || error.code === 'P0002' ? '기록이 삭제되었거나 수정할 수 없어요. 입력 내용은 유지됩니다.'
          : '수정 결과를 확인하지 못했어요. 입력 내용은 유지됩니다. 연결 상태를 확인하고 다시 시도해 주세요.'
        : '저장을 확인하지 못했어요. 입력 내용은 유지됩니다. 연결을 확인하고, 재시도 전 홈에 같은 기록이 있는지 확인해 주세요.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return <div className="activity-page">
    <header className="activity-heading"><Link to={cancelTo} state={location.state}>{editing ? '기록 상세로' : cancelTo === '/home' ? '홈으로' : '기록 목록으로'}</Link><h1>{editing ? '운동 기록 수정' : '운동 기록하기'}</h1></header>
    <form ref={formRef} onSubmit={submit} noValidate>
      <fieldset disabled={busy} className="activity-fields">
        <legend className="sr-only">운동 기록</legend>
        <fieldset className="activity-sports" disabled={editing}><legend>{editing ? '종목 · 변경할 수 없어요' : '종목'}</legend>
          {ACTIVITY_SPORTS.map(value => <label key={value} data-selected={form.sport === value}>
            <input type="radio" name="sport" value={value} checked={form.sport === value} onChange={() => changeSport(value)} />{SPORT_LABEL[value]}
          </label>)}
        </fieldset>
        <div className="activity-basics">
          <Field id="activity-date" label="운동 날짜" type="date" required min="1900-01-01" max="9999-12-24" value={form.date} onChange={e => change('date', e.target.value)} error={errors.date} />
          <fieldset className="activity-duration"><legend>운동 시간</legend><div className="activity-duration-fields">
            <Field id="activity-minutes" label="분" type="number" inputMode="numeric" required min="0" step="1" placeholder="30" value={form.minutes} onChange={e => change('minutes', e.target.value)} error={errors.minutes} />
            <Field id="activity-seconds" label="초" type="number" inputMode="numeric" required min="0" max="59" step="1" value={form.seconds ?? '0'} onChange={e => change('seconds', e.target.value)} error={errors.seconds} />
          </div></fieldset>
          {hasDistance(form.sport) && <Field id="activity-distance" label={'거리 (' + distanceUnit(form.sport) + ')'} type="number" inputMode={form.sport === 'swimming' ? 'numeric' : 'decimal'} required={!editing} min="0" step={form.sport === 'swimming' ? '1' : '0.001'} placeholder={form.sport === 'swimming' ? '1000' : '5.2'} value={form.distance} onChange={e => change('distance', e.target.value)} error={errors.distance} />}
          {form.sport === 'swimming' && <Field id="activity-laps" label="랩 수 (선택)" type="number" inputMode="numeric" min="0" max="10000" step="1" placeholder="20" hint="편도 한 번이 1랩입니다. 총 거리는 위에 직접 입력해 주세요." value={form.lapCount ?? ''} onChange={e => change('lapCount', e.target.value)} error={errors.lapCount} />}
        </div>
        {form.sport === 'gym' && <section className="activity-sets" aria-labelledby="sets-title">
          <div className="activity-sets-head"><h2 id="sets-title">운동 세트</h2><span>{editing ? '빈 횟수·중량은 미입력으로 저장' : '맨몸 운동은 0kg'}</span></div>
          <div className="exercise-history-status" role="status">
            {exerciseNamesPending && <span>내 기록의 운동 이름을 불러오는 중…</span>}
            {exerciseNamesError && <span>내 기록을 불러오지 못했어요. 기본 추천과 직접 입력은 사용할 수 있어요. {onExerciseNamesRetry && <button type="button" onClick={onExerciseNamesRetry}>다시 불러오기</button>}</span>}
          </div>
          {form.sets.map((row, index) => <fieldset className="activity-set" key={index}><legend>세트 {index + 1}</legend>
            <ExerciseNameInput id={'name-' + index} value={row.name} onChange={value => changeSet(index, 'name', value)} error={errors['name-' + index]} history={exerciseNames} onHistoryRequest={onExerciseNameFocus} />
            <Field id={'reps-' + index} label="횟수" type="number" inputMode="numeric" required={!editing} min={editing ? '0' : '1'} step="1" value={row.reps} onChange={e => changeSet(index, 'reps', e.target.value)} error={errors['reps-' + index]} />
            <Field id={'weight-' + index} label="중량 (kg)" type="number" inputMode="decimal" required={!editing} min="0" step="0.01" value={row.weight} onChange={e => changeSet(index, 'weight', e.target.value)} error={errors['weight-' + index]} />
            <Button variant="ghost" aria-label={'세트 ' + (index + 1) + ' 삭제'} disabled={form.sets.length === 1} onClick={() => { change('sets', form.sets.filter((_, i) => i !== index)); setErrors({}); }}>삭제</Button>
          </fieldset>)}
          {errors.sets && <FormMessage>{errors.sets}</FormMessage>}
          <Button variant="ghost" disabled={form.sets.length >= 100} onClick={() => change('sets', [...form.sets, emptySet()])}>＋ 세트 추가</Button>
        </section>}
        <div className="field"><label htmlFor="activity-note">메모 <span className="activity-optional">선택</span></label>
          <textarea id="activity-note" rows="3" maxLength={1000} value={form.note} onChange={e => change('note', e.target.value)} aria-invalid={errors.note ? true : undefined} aria-describedby={errors.note ? 'activity-note-error' : undefined} placeholder="운동 중 느낀 점이나 남겨둘 내용" />
          {errors.note && <p id="activity-note-error" className="field-error">{errors.note}</p>}
        </div>
        <FormMessage>{message}</FormMessage>
        <div className="activity-actions"><Button type="submit" disabled={busy}>{busy ? '저장 중…' : editing ? '수정 저장하기' : '기록 저장하기'}</Button>{!busy && <Link to={cancelTo} state={location.state}>취소</Link>}</div>
      </fieldset>
    </form>
  </div>;
}
