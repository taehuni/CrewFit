import {createContext,useContext,useLayoutEffect,useRef} from 'react';
import useLeaveGuard from '../../shared/useLeaveGuard.jsx';
import {createUnsavedFormState} from '../../shared/unsavedFormState.js';

const Changes=createContext(null);
export function ProfileChangesProvider({children}) {
  const entries=useRef(new Set());
  const guard=useLeaveGuard(()=>[...entries.current].some(check=>check()), '아직 저장하지 않은 프로필 변경이 있어요. 항목별 저장을 마친 뒤 이동해 주세요.');
  return <Changes.Provider value={entries.current}>{children}{guard}</Changes.Provider>;
}

// All profile sections share the page's single router blocker.
export function useProfileChanges(dirty) {
  const entries=useContext(Changes),current=useRef(dirty);current.current=dirty;
  useLayoutEffect(()=>{
    if(!entries)return;
    const check=()=>typeof current.current==='function'?current.current():current.current;
    entries.add(check);return()=>entries.delete(check);
  },[entries]);
}

export function useConfirmProfileExit() {
  const entries=useContext(Changes);
  return ()=>!entries||![...entries].some(check=>check())||window.confirm('저장하지 않은 프로필 변경이 있어요. 저장하지 않고 로그아웃할까요?');
}

export function useProfileForm(values) {
  const state=useRef(null);
  if(!state.current)state.current=createUnsavedFormState(values);
  state.current.update(values);
  useProfileChanges(state.current.isDirty);
  return {markSaved(next=values){state.current.update(next);state.current.markSaved();}};
}
