const fields=['title','sport','scheduled_on','start_time','minutes','note'];

export function planDraftChanged(draft,initial){
 return !!draft&&fields.some(key=>draft[key]!==initial?.[key]);
}

export function proposalDraftChanged(items,proposals,savedPositions=new Set()){
 return items.some(item=>!savedPositions.has(item.position)&&planDraftChanged(item,proposals[item.position]));
}

export function newWorkoutDraft(date,id){
 return {id,title:'',sport:'walking',scheduled_on:date,start_time:'19:00',minutes:30,note:''};
}

export function proposalDrafts(proposals,plans,turnId){
 return proposals.map((proposal,position)=>{
  const saved=plans.find(plan=>plan.turn_id===turnId&&plan.position===position);
  const values=saved?Object.fromEntries(fields.map(key=>[key,key==='start_time'?saved[key].slice(0,5):saved[key]])):proposal;
  return {...values,position,selected:true};
 });
}

export function refreshProposalDrafts(current,proposals,plans,turnId,active){
 const latest=proposalDrafts(proposals,plans,turnId);
 if(!active)return latest;
 const saved=new Set(plans.filter(plan=>plan.turn_id===turnId).map(plan=>plan.position));
 return current.map(item=>saved.has(item.position)?latest[item.position]:item);
}
