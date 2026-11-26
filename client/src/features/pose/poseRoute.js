const LOCAL_EXERCISES=new Set(['squat','lunge','pushup']);

// Keep existing shared links working while making exercise selection the default.
export function poseRoute(search='',hash=''){
 const params=new URLSearchParams(search),view=params.get('view');
 if(view==='criteria')return 'criteria';
 if(view==='history')return 'history';
 if(view==='auto')return 'auto';
 if(view==='local'&&LOCAL_EXERCISES.has(params.get('exercise')))return 'local';
 if(hash==='#pose-history-title')return 'history';
 return 'selection';
}
