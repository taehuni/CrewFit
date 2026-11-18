// A cancelable event lets the currently open surface consume Back before routing.
export function consumeSurfaceBack(target) {
  return !target.dispatchEvent(new Event('crewfit:surface-back', {cancelable:true}));
}
