export function createLeaveGuardRegistry() {
  const entries = new Set();
  return {
    register(read) { entries.add(read); return () => entries.delete(read); },
    active() {
      return [...entries].flatMap(read => {
        const {enabled, message} = read();
        return (typeof enabled === 'function' ? enabled() : enabled) ? [message] : [];
      });
    },
  };
}
