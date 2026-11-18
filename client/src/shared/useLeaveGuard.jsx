import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import {createLeaveGuardRegistry} from './leaveGuardRegistry.js';
import { createPortal } from 'react-dom';
import { useBlocker, useBeforeUnload } from 'react-router';
import './leave-guard.css';

const LeaveGuards = createContext(null);

// React Router supports one blocker. All mounted forms register with that blocker.
export function LeaveGuardProvider({children}) {
  const registry = useRef(null);
  if (!registry.current) registry.current = createLeaveGuardRegistry();
  const cancel = useRef(null);
  const shouldGuard = () => registry.current.active().length > 0;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => shouldGuard() &&
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  const messages = registry.current.active();
  const message = messages.length > 1 ? '여러 항목에 저장하지 않은 변경이 있어요. 저장하지 않고 나갈까요?' : messages[0];
  const pending = blocker.state === 'blocked';
  useBeforeUnload(event => { if (shouldGuard()) { event.preventDefault(); event.returnValue = ''; } });
  useEffect(() => {
    if (!pending) return;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancel.current?.focus();
    const trap = event => {
      if (event.key === 'Escape') { event.preventDefault(); blocker.reset(); }
      if (event.key === 'Tab') {
        const buttons = cancel.current?.parentElement?.querySelectorAll('button');
        if (buttons?.length === 2) { event.preventDefault(); (document.activeElement === buttons[0] ? buttons[1] : buttons[0]).focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); document.body.style.overflow = previousOverflow; previous?.focus?.({ preventScroll: true }); };
  }, [pending, blocker]);
  const dialog = pending ? createPortal(<div className="leave-guard-overlay"><section className="leave-guard" role="alertdialog" aria-modal="true" aria-labelledby="leave-guard-title" aria-describedby="leave-guard-message">
    <h2 id="leave-guard-title">이 화면에서 나갈까요?</h2><p id="leave-guard-message">{message}</p>
    <div><button ref={cancel} className="btn btn-primary" onClick={() => blocker.reset()}>계속하기</button><button className="btn btn-ghost" onClick={() => blocker.proceed()}>나가기</button></div>
  </section></div>, document.body) : null;
  return <LeaveGuards.Provider value={registry.current}>{children}{dialog}</LeaveGuards.Provider>;
}

export default function useLeaveGuard(enabled, message = '저장하지 않은 내용이 있어요. 나가면 사라져요.') {
  const registry = useContext(LeaveGuards);
  const entry = useRef({enabled,message});
  entry.current = {enabled,message};
  useLayoutEffect(() => {
    if (!registry) throw new Error('LeaveGuardProvider is required');
    return registry.register(() => entry.current);
  }, [registry]);
  return null;
}
