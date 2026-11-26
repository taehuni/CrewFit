const PREFIX = 'crewfit-session-draft:';
export const DRAFT_LIFETIME = 30 * 60 * 1000;

// Only this tab's short-lived draft. Never copy questions to localStorage or logs.
export function createSessionDrafts(storage, now = Date.now) {
  const key = owner => PREFIX + owner;
  function remove(owner) { try { storage?.removeItem(key(owner)); } catch {} }
  function clear() {
    try {
      for (let index = storage.length - 1; index >= 0; index--) {
        const name = storage.key(index);
        if (name?.startsWith(PREFIX)) storage.removeItem(name);
      }
    } catch {}
  }
  function read(owner) {
    if (!owner) return '';
    try {
      const draft = JSON.parse(storage?.getItem(key(owner)) || 'null');
      if (draft?.owner === owner && typeof draft.message === 'string' && draft.message.length <= 2000 &&
          Number.isFinite(draft.at) && now() >= draft.at && now() - draft.at < DRAFT_LIFETIME) return draft.message;
    } catch {}
    remove(owner);
    return '';
  }
  function write(owner, message) {
    if (!owner || typeof message !== 'string') return false;
    if (!message) { remove(owner); return true; }
    try {
      if (!storage) return false;
      storage.setItem(key(owner), JSON.stringify({ owner, message: message.slice(0, 2000), at: now() }));
      return true;
    } catch { return false; }
  }
  function retainOwner(owner) {
    try {
      for (let index = storage.length - 1; index >= 0; index--) {
        const name = storage.key(index);
        if (name?.startsWith(PREFIX) && name !== key(owner)) storage.removeItem(name);
      }
    } catch {}
    if (owner) read(owner); else clear();
  }
  return { read, write, remove, clear, retainOwner };
}
let storage;
try { storage = globalThis.sessionStorage; } catch {}
export const sessionDrafts = createSessionDrafts(storage);
