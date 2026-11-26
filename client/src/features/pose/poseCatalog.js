import {GYM_EXERCISE_CRITERIA} from './gymCriteria.js';
import {visionCriteria} from './poseVision.js';

export const POSE_BODY_REGIONS=[
 {id:'all',label:'전체'},
 {id:'lower',label:'하체'},
 {id:'back',label:'등'},
 {id:'chest',label:'가슴'},
 {id:'shoulders',label:'어깨'},
 {id:'arms',label:'팔'},
 {id:'core',label:'코어'},
 {id:'full',label:'전신'},
];

// Only an image of this exact exercise may be used. Other rows use their body-region illustration.
export const POSE_EXERCISE_IMAGES={
 lat_pulldown:'/images/pose/exercises/lat_pulldown.webp',
 seated_cable_row:'/images/pose/exercises/seated_cable_row.webp',
 single_arm_dumbbell_row:'/images/pose/exercises/single_arm_dumbbell_row.webp',
 chin_up:'/images/pose/exercises/chin_up.webp',
};

// A stationary lunge must remain separate from the forward-lunge photo criteria.
const LOCAL_EXERCISES=[
 {id:'squat',catalogId:'bodyweight_squat',label:'맨몸 스쿼트',bodyRegion:'하체',equipment:['맨몸'],aliases:['스쿼트','squat','bodyweight squat'],detail:'정면은 무릎 움직임만 확인해요.'},
 {id:'lunge',label:'제자리 런지',bodyRegion:'하체',equipment:['맨몸'],aliases:['런지','lunge','stationary lunge','static lunge'],detail:'앞발을 고정한 측면만 지원해요.'},
 {id:'pushup',catalogId:'floor_pushup',label:'바닥 푸시업',bodyRegion:'가슴',equipment:['맨몸'],aliases:['푸시업','팔굽혀펴기','pushup','push-up','push up'],detail:'발끝을 지지한 측면만 지원해요.'},
].map(item=>({...item,mode:'local',method:'측면 횟수·자세',href:`/pose?view=local&exercise=${item.id}`}));
const groupedIds=new Set(LOCAL_EXERCISES.map(item=>item.catalogId).filter(Boolean));
const REGION_IDS=Object.fromEntries(POSE_BODY_REGIONS.map(item=>[item.label,item.id]));
const EXTRA_ALIASES={
 floor_bridge:['glute bridge','hip bridge'],
 chin_up:['chin up','chinup'],
 forearm_plank:['front plank'],
 straight_arm_plank:['high plank'],
 situp:['sit up','sit-up'],
};
const EQUIPMENT_ALIASES=[
 ['맨몸','bodyweight no equipment'],['덤벨','dumbbell'],['바벨','barbell'],
 ['케틀벨','kettlebell'],['케이블','cable'],['머신','machine'],
 ['벤치','bench'],['철봉','pull up bar chin up bar'],['로프','rope'],
];
const FIRST_IN_REGION={back:['lat_pulldown','seated_cable_row','single_arm_dumbbell_row','chin_up']};

const catalog=[...LOCAL_EXERCISES,...GYM_EXERCISE_CRITERIA.filter(item=>!groupedIds.has(item.id)).map(item=>{
 const photo=Boolean(visionCriteria(item.id));
 return {...item,mode:photo?'photo':'record',method:photo?'사진 관찰 · 횟수 미측정':'이름·시간 기록',detail:photo?'':'자세 평가는 제공하지 않아요.'};
})];

export const POSE_EXERCISE_CATALOG=POSE_BODY_REGIONS.filter(region=>region.id!=='all').flatMap(region=>{
 const priority=FIRST_IN_REGION[region.id]||[];
 return catalog.filter(item=>item.bodyRegion===region.label).sort((a,b)=>{
  const aIndex=priority.indexOf(a.id),bIndex=priority.indexOf(b.id);
  return (aIndex<0?priority.length:aIndex)-(bIndex<0?priority.length:bIndex);
 }).map(item=>({...item,region:REGION_IDS[item.bodyRegion],image:POSE_EXERCISE_IMAGES[item.id]||null}));
});

export function poseBodyRegion(id){return POSE_BODY_REGIONS.find(item=>item.id===id)||POSE_BODY_REGIONS[0];}

export function normalizePoseSearch(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[\s_\-·]+/g,'');}

export function filterPoseExercises({search='',region='all'}={}){
 const activeRegion=poseBodyRegion(region).id;
 const terms=String(search).normalize('NFKC').trim().split(/\s+/).map(normalizePoseSearch).filter(Boolean);
 return POSE_EXERCISE_CATALOG.filter(item=>{
  if(activeRegion!=='all'&&item.region!==activeRegion)return false;
  const equipment=item.equipment.join(' ');
  const equipmentAliases=EQUIPMENT_ALIASES.filter(([word])=>equipment.includes(word)).map(([,aliases])=>aliases);
  const words=normalizePoseSearch([item.id,item.catalogId,item.label,item.bodyRegion,...item.aliases,...item.equipment,...equipmentAliases,...(EXTRA_ALIASES[item.id]||[])].join(' '));
  return terms.every(term=>words.includes(term));
 });
}

export function poseExerciseSelection(item){return {id:item.mode==='record'?'other':item.id,label:item.label};}
