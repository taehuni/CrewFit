// Keep snapshots only in memory; no form contents are persisted or logged.
export function createUnsavedFormState(initialValues) {
  let baseline = JSON.stringify(initialValues);
  let current = baseline;
  return {
    update(values) { current = JSON.stringify(values); },
    isDirty() { return current !== baseline; },
    markSaved() { baseline = current; },
  };
}
