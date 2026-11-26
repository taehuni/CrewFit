import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkoutDraft,planDraftChanged,proposalDraftChanged,proposalDrafts,refreshProposalDrafts} from './planDrafts.js';

test('a blank new plan and a reverted edit do not warn on cancel',()=>{
 const initial=newWorkoutDraft('2026-11-21','draft');
 assert.equal(planDraftChanged({...initial},initial),false);
 assert.equal(planDraftChanged({...initial,title:'저녁 걷기'},initial),true);
 assert.equal(planDraftChanged({...initial,minutes:45},initial),true);
 assert.equal(planDraftChanged(null,initial),false);
});

test('reopening a saved proposal shows its saved edits instead of the original suggestion',()=>{
 const initial=newWorkoutDraft('2026-11-21','draft');
 const saved={...initial,turn_id:'turn',position:0,title:'저장한 새 제목',start_time:'20:00:00'};
 const [draft]=proposalDrafts([initial],[saved],'turn');
 assert.equal(draft.title,saved.title);
 assert.equal(draft.start_time,'20:00');
 assert.equal(draft.turn_id,undefined);
 assert.equal(draft.id,undefined);
});

test('proposal guards only unsaved content edits, not selection or already-saved positions',()=>{
 const initial=newWorkoutDraft('2026-11-21','draft');
 const items=[{...initial,position:0,selected:false}];
 assert.equal(proposalDraftChanged(items,[initial]),false);
 items[0].title='수정한 계획';
 assert.equal(proposalDraftChanged(items,[initial]),true);
 assert.equal(proposalDraftChanged(items,[initial],new Set([0])),false);
 items[0].title='';
 assert.equal(proposalDraftChanged(items,[initial]),false);
});

test('saved plan edits refresh locked proposal fields while preserving another unsaved edit',()=>{
 const original=newWorkoutDraft('2026-11-21','draft');
 const proposals=[original,{...original,title:'두 번째 계획'}];
 const firstSave={...original,turn_id:'turn',position:0,title:'첫 저장 제목'};
 const current=proposalDrafts(proposals,[firstSave],'turn');
 current[1].note='아직 저장하지 않은 변경';
 const updated={...firstSave,title:'내 계획에서 수정한 제목',start_time:'21:00:00'};
 const active=refreshProposalDrafts(current,proposals,[updated],'turn',true);
 assert.equal(active[0].title,updated.title);
 assert.equal(active[0].start_time,'21:00');
 assert.equal(active[1].note,'아직 저장하지 않은 변경');
 const reopened=refreshProposalDrafts(current,proposals,[updated],'turn',false);
 assert.equal(reopened[0].title,updated.title);
 assert.equal(reopened[0].start_time,'21:00');
 assert.equal(reopened[1].note,original.note);
});
