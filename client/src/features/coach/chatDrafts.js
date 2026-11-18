// One store belongs to one mounted, authenticated chat dock. Never persist messages.
export function createChatDrafts() {
  const rooms = new Map();
  return {
    read(key) { return rooms.get(key) || {text:'',pending:null}; },
    write(key, text) {
      const old=rooms.get(key);
      if (!text) { rooms.delete(key); return; }
      rooms.set(key,{text,pending:old?.pending?.body===text.trim()?old.pending:null});
    },
    submitting(key, pending) {
      const old=rooms.get(key);
      if(old) rooms.set(key,{...old,pending});
    },
    sent(key, id) { if(rooms.get(key)?.pending?.id===id) rooms.delete(key); },
    clearRoom(key) { rooms.delete(key); },
    clear() { rooms.clear(); },
  };
}
