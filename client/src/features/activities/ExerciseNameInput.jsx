import { useEffect, useRef, useState } from 'react';
import { exerciseSuggestions } from './exerciseNames.js';
import './exercise-names.css';

export default function ExerciseNameInput({ id, value, onChange, error, history = [], onHistoryRequest, label = '운동 이름' }) {
  const input = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const choices = exerciseSuggestions(history, value);
  const listId = id + '-suggestions';
  const expanded = open && choices.length > 0;
  const activeOption = expanded && active >= 0 && active < choices.length ? listId + '-' + active : undefined;
  useEffect(() => {
    if (activeOption) document.getElementById(activeOption)?.scrollIntoView({ block: 'nearest' });
  }, [activeOption]);
  function pick(name) {
    onChange(name);
    input.current?.focus();
    setActive(-1);
    setOpen(false);
  }
  function keyDown(event) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive(index => {
        if (!choices.length) return -1;
        if (!open || index < 0) return event.key === 'ArrowDown' ? 0 : choices.length - 1;
        return (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
      });
    } else if (event.key === 'Escape') {
      event.preventDefault(); setOpen(false); setActive(-1);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (activeOption) pick(choices[active].name);
      else setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false); setActive(-1);
    }
  }
  return <div className="field exercise-name" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
  }}>
    <div className="field-label-row"><label htmlFor={id}>{label}</label></div>
    <input ref={input} id={id} required maxLength={100} placeholder="스쿼트" value={value}
      role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
      aria-activedescendant={activeOption} aria-invalid={error ? true : undefined}
      aria-describedby={error ? id + '-error' : id + '-hint'} autoComplete="off"
      onFocus={() => { setOpen(true); setActive(-1); onHistoryRequest?.(); }}
      onClick={() => setOpen(true)}
      onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }}
      onKeyDown={keyDown} />
    {open && <div className="exercise-suggestions">
      {choices.length ? <ul id={listId} role="listbox" aria-label="운동 이름 추천">
        {choices.map((choice, index) => <li key={choice.name} role="presentation">
          <button type="button" role="option" id={listId + '-' + index} aria-selected={active === index} tabIndex={-1}
            onMouseDown={event => event.preventDefault()} onClick={() => pick(choice.name)}>
            <span>{choice.name}</span><small>{choice.source === 'history' ? '내 기록' : '기본 운동'}</small>
          </button>
        </li>)}
      </ul> : <p>일치하는 추천이 없어요. 입력한 이름으로 저장할 수 있어요.</p>}
    </div>}
    <p id={id + '-hint'} className="sr-only">추천을 선택하거나 직접 입력하세요. 방향키로 이동, Enter로 선택, Escape로 닫습니다.</p>
    {error && <p id={id + '-error'} className="field-error">{error}</p>}
  </div>;
}
