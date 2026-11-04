export const EXERCISE_GUIDES={
 squat:{label:'스쿼트',description:'정면의 무릎 움직임과 측면의 몸통·발을 나누어 확인해요.',views:[{id:'side',label:'측면'},{id:'front',label:'정면'}],setup:'발 전체를 바닥에 붙이고 잠시 바로 서 주세요.',metric:'무릎 각도',scope:'맨몸 스쿼트',source:['NASM · 스쿼트 원칙','https://www.nasm.org/resource-center/blog/training/biomechanics-of-the-squat']},
 lunge:{label:'런지',description:'발을 앞뒤로 고정한 런지에서 앞다리의 움직임을 확인해요.',views:[{id:'left',label:'왼다리 앞 · 측면'},{id:'right',label:'오른다리 앞 · 측면'}],setup:'선택한 다리를 앞으로 놓고, 발을 앞뒤로 고정한 채 앞무릎을 편안하게 펴 주세요. 왼쪽·오른쪽은 화면이 아닌 내 몸 기준이에요.',metric:'앞무릎 각도',scope:'제자리 런지 · 한쪽씩',source:['ACE · 런지 원칙','https://www.acefitness.org/resources/everyone/exercise-library/94/forward-lunge/']},
 pushup:{label:'푸시업',description:'팔을 굽히고 펴는 동안 몸통과 골반의 선을 확인해요.',views:[{id:'side',label:'측면'}],setup:'발끝과 손으로 지지하고 팔을 편 상태에서 몸을 길게 정렬해 잠시 유지해 주세요. 무릎을 대거나 벤치를 쓰는 변형은 아직 지원하지 않아요.',metric:'팔꿈치 각도',scope:'바닥 푸시업 · 발끝 지지',source:['NASM · 푸시업 원칙','https://www.nasm.org/resource-center/exercise-library/push-up']},
};
export function getExerciseGuide(exercise,view){
 const guide=EXERCISE_GUIDES[exercise]||EXERCISE_GUIDES.squat;
 const front=exercise==='squat'&&view==='front';
 return {...guide,front,viewLabel:guide.views.find(v=>v.id===view)?.label||guide.views[0].label,
  framing:front?'카메라를 정면에 두고 양쪽 어깨·골반·무릎·발목이 모두 보이게 서 주세요.':exercise==='pushup'?'카메라를 몸 옆에 고정하고 어깨·팔꿈치·손목·골반·발목을 모두 담아 주세요.':'카메라를 몸 옆에 고정하고 어깨부터 발끝까지 모두 담아 주세요.',
  evaluates:front?'양쪽 무릎이 시작 자세보다 안쪽으로 이동하는 모습':exercise==='pushup'?'어깨–발목 선에 대한 골반 위치 변화, 팔꿈치 각도와 반복':'뒤꿈치 들림 신호, 시작 자세 대비 몸통 기울기 변화, 무릎 각도와 반복',
  excludes:front?'정면에서는 깊이·횟수·척추 모양을 평가하지 않아요. 발끝 방향이나 실제 관절 회전도 이 화면만으로 확정할 수 없어요.':exercise==='pushup'?'팔꿈치 벌어짐, 손바닥 압력, 척추의 세부 곡선은 평가하지 않아요.':'측면에서는 무릎의 좌우 정렬·척추의 세부 곡선·발바닥 압력은 평가하지 않아요.',
 };
}
