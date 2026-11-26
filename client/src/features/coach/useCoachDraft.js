import { useEffect, useRef, useState } from 'react';
import { sessionDrafts } from '../../shared/sessionDrafts.js';
import useLeaveGuard from '../../shared/useLeaveGuard.jsx';
import { createCoachDraftWriter } from './coachDraftWriter.js';

export default function useCoachDraft(owner, initialPrompt = '') {
  const [draft, setDraft] = useState(() => ({ owner, message: sessionDrafts.read(owner) || initialPrompt, kept: true }));
  const writer = useRef(null);
  if (!writer.current) writer.current = createCoachDraftWriter(sessionDrafts);
  const write = writer.current.bind(owner);
  const message = draft.owner === owner ? draft.message : '';
  function update(value) {
    const result = write(value);
    if (result) setDraft({ owner, message: value, kept: result.kept });
  }
  useEffect(() => {
    writer.current.activate();
    const value = sessionDrafts.read(owner) || (draft.owner === owner ? draft.message : '');
    const kept = sessionDrafts.write(owner, value);
    setDraft({ owner, message: value, kept });
    return () => writer.current.dispose();
  }, [owner]);
  const guard = useLeaveGuard(Boolean(message.trim()) && !draft.kept,
    '이 브라우저에서는 질문 초안을 잠시 보관할 수 없어요. 나가면 작성한 질문이 사라져요.');
  return { message, setMessage: update, guard, kept: draft.kept };
}
