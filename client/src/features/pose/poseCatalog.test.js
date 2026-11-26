import test from 'node:test';
import assert from 'node:assert/strict';
import {GYM_EXERCISE_CRITERIA} from './gymCriteria.js';
import {visionCriteria} from './poseVision.js';
import {POSE_BODY_REGIONS,POSE_EXERCISE_CATALOG,POSE_EXERCISE_IMAGES,filterPoseExercises,normalizePoseSearch,poseBodyRegion,poseExerciseSelection} from './poseCatalog.js';

const ids=options=>filterPoseExercises(options).map(item=>item.id);

test('the unified catalog contains every exercise without duplicate squat or pushup routes',()=>{
 assert.equal(POSE_EXERCISE_CATALOG.length,51);
 assert.equal(new Set(POSE_EXERCISE_CATALOG.map(item=>item.id)).size,51);
 assert.deepEqual(POSE_EXERCISE_CATALOG.filter(item=>item.mode==='local').map(item=>item.id),['squat','lunge','pushup']);
 assert.equal(POSE_EXERCISE_CATALOG.filter(item=>item.mode==='photo').length,47);
 assert.equal(POSE_EXERCISE_CATALOG.filter(item=>item.mode==='record').length,1);
 for(const criterion of GYM_EXERCISE_CRITERIA){
  assert.ok(POSE_EXERCISE_CATALOG.some(item=>item.id===criterion.id||item.catalogId===criterion.id),criterion.id);
 }
 assert.ok(!ids().includes('bodyweight_squat'));
 assert.ok(!ids().includes('floor_pushup'));
 assert.ok(ids().includes('forward_lunge'));
});

test('each body region has only its own exercises and all returns all 51',()=>{
 assert.deepEqual(POSE_BODY_REGIONS.map(item=>item.label),['전체','하체','등','가슴','어깨','팔','코어','전신']);
 assert.equal(ids({region:'all'}).length,51);
 for(const region of POSE_BODY_REGIONS.slice(1)){
  const exercises=filterPoseExercises({region:region.id});
  assert.ok(exercises.length>0,region.id);
  assert.ok(exercises.every(item=>item.bodyRegion===region.label),region.id);
 }
 assert.equal(ids({region:'back'}).length,8);
 assert.deepEqual(ids({region:'back'}).slice(0,4),['lat_pulldown','seated_cable_row','single_arm_dumbbell_row','chin_up']);
 assert.deepEqual(ids({region:'invalid'}),ids({region:'all'}));
 assert.equal(poseBodyRegion('invalid').id,'all');
});

test('search handles Korean spacing, English, alternate names and equipment',()=>{
 assert.equal(normalizePoseSearch(' ＰＵＳＨ - ＵＰ '),'pushup');
 assert.ok(ids({search:' 랫풀다운 '}).includes('lat_pulldown'));
 assert.ok(ids({search:'랫 풀 다운'}).includes('lat_pulldown'));
 assert.ok(ids({search:'LAT PULLDOWN'}).includes('lat_pulldown'));
 assert.ok(ids({search:'렛풀다운'}).includes('lat_pulldown'));
 assert.ok(ids({search:'언더그립풀업'}).includes('chin_up'));
 assert.ok(ids({search:'PUSH-UP'}).includes('pushup'));
 assert.ok(ids({search:'팔 굽혀 펴기'}).includes('pushup'));
 assert.ok(ids({search:'덤벨 로우'}).includes('single_arm_dumbbell_row'));
 assert.ok(ids({search:'로우 덤벨'}).includes('single_arm_dumbbell_row'));
 assert.ok(ids({search:'dumbbell bench'}).includes('single_arm_dumbbell_row'));
 assert.ok(ids({search:'machine'}).includes('leg_press'));
 assert.ok(ids({search:'bodyweight'}).includes('squat'));
 assert.ok(ids({search:'sit-up'}).includes('situp'));
 assert.equal(ids({search:'   \t  '}).length,51);
 assert.deepEqual(ids({search:'없는운동'}),[]);
});

test('changing region keeps the search intersection explicit instead of silently clearing it',()=>{
 assert.ok(ids({search:'케이블',region:'back'}).length>0);
 assert.ok(filterPoseExercises({search:'케이블',region:'back'}).every(item=>item.region==='back'&&item.equipment.some(value=>value.includes('케이블'))));
 assert.deepEqual(ids({search:'케이블',region:'lower'}),[]);
 assert.ok(ids({search:'케이블',region:'all'}).length>ids({search:'케이블',region:'back'}).length);
 assert.equal(ids({search:'',region:'back'}).length,8);
});

test('selection modes preserve local links, referenced photo criteria and record-only situps',()=>{
 for(const item of POSE_EXERCISE_CATALOG){
  const selection=poseExerciseSelection(item);
  if(item.mode==='local')assert.equal(item.href,`/pose?view=local&exercise=${item.id}`);
  if(item.mode==='photo'){
   assert.ok(visionCriteria(item.id));
   assert.equal(selection.id,item.id);
   assert.equal(item.method,'사진 관찰 · 횟수 미측정');
  }
  assert.equal(selection.label,item.label);
 }
 const situp=POSE_EXERCISE_CATALOG.find(item=>item.id==='situp');
 assert.deepEqual(poseExerciseSelection(situp),{id:'other',label:'싯업'});
 assert.equal(situp.mode,'record');
 assert.equal(situp.method,'이름·시간 기록');
});

test('exercise photos only map to the same movement; remaining exercises use region illustrations',()=>{
 for(const item of POSE_EXERCISE_CATALOG){
  if(item.image)assert.equal(item.image,`/images/pose/exercises/${item.id}.webp`);
  else assert.ok(POSE_BODY_REGIONS.some(region=>region.id===item.region));
 }
 assert.deepEqual(POSE_EXERCISE_CATALOG.filter(item=>item.image).map(item=>item.id),Object.keys(POSE_EXERCISE_IMAGES));
});
