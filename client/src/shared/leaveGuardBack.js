export function listenForLeaveGuardBack(target, reset) {
  // The confirmation is above other open surfaces. Capture Back before their
  // listeners, then consume it before native route navigation can run.
  const cancelNavigation = event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    reset();
  };
  const options = {capture:true};
  target.addEventListener('crewfit:surface-back', cancelNavigation, options);
  return () => target.removeEventListener('crewfit:surface-back', cancelNavigation, options);
}
