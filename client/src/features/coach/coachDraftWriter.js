// An async answer may finish after navigation or an account change. Its captured
// writer must never clear a question entered in a later account/session view.
export function createCoachDraftWriter(store) {
  let current = null;
  return {
    bind(owner) {
      if (current?.owner !== owner) current = { owner, active: true };
      const scope = current;
      return message => scope !== current || !scope.active ? null : { kept: store.write(owner, message) };
    },
    activate() { if (current) current.active = true; },
    dispose() { if (current) current.active = false; },
  };
}
