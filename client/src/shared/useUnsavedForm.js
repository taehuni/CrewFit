import { useRef } from 'react';
import useLeaveGuard from './useLeaveGuard.jsx';
import { createUnsavedFormState } from './unsavedFormState.js';

// Values must be JSON-compatible. Represent File attachments separately as flags.
export default function useUnsavedForm(values) {
  const state = useRef(null);
  if (!state.current) state.current = createUnsavedFormState(values);
  state.current.update(values);
  const leaveGuard = useLeaveGuard(state.current.isDirty);
  return { leaveGuard, markSaved: state.current.markSaved };
}
