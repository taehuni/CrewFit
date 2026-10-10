// Only last_seq is mutable. A generic upsert also updates the protected keys.
export async function markCrewRead(db, crewId, userId, seq, direct = false) {
  const table = direct ? 'direct_chat_reads' : 'crew_chat_reads';
  const key = direct ? 'peer_id' : 'crew_id';
  const existing = await db.from(table).select('last_seq')
    .eq(key, crewId).eq('user_id', userId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data && Number(existing.data.last_seq) >= Number(seq)) return;
  if (!existing.data) {
    const inserted = await db.from(table).insert({[key]: crewId, user_id: userId, last_seq: seq});
    if (!inserted.error) return;
    // Another tab may have created the marker after our read.
    if (inserted.error.code !== '23505') throw inserted.error;
  }
  const updated = await db.from(table).update({last_seq: seq})
    .eq(key, crewId).eq('user_id', userId).lt('last_seq', seq);
  if (updated.error) throw updated.error;
}

