export const partnerCatalog=[
 {id:'mapo-demo',name:'마포 무브 스튜디오',area:'서울 마포',tag:'처음 시작하는 웨이트',sport:'gym',color:'orange',icon:'01',description:'기구 사용부터 운동 루틴까지, 나의 속도로 시작하는 공간을 소개하는 데모예요.',features:['기초 기구 안내','개인 락커','샤워 공간'],offers:[{id:'mapo-day',name:'헬스 1일 체험권',amount:15000,minutes:60},{id:'mapo-pt',name:'입문 PT 체험',amount:30000,minutes:50}]},
 {id:'seoul-demo',name:'밸런스 필라테스',area:'서울 성동',tag:'차분하게 쌓는 움직임',sport:'other',color:'green',icon:'02',description:'소규모 체험 수업과 일상 속 움직임을 연결하는 제휴 화면 예시예요.',features:['소규모 수업','입문 클래스','탈의 공간'],offers:[{id:'balance-class',name:'그룹 수업 체험권',amount:20000,minutes:50}]},
 {id:'run-demo',name:'리버 러닝 랩',area:'서울 영등포',tag:'함께 만드는 첫 5km',sport:'running',color:'blue',icon:'03',description:'러닝 크루 활동과 기초 코칭을 함께 소개하는 가상 파트너예요.',features:['기초 러닝 수업','준비 운동','그룹 코칭'],offers:[{id:'river-run',name:'러닝 입문 클래스',amount:12000,minutes:60}]}
];
export function findOffer(id){for(const facility of partnerCatalog){const offer=facility.offers.find(o=>o.id===id);if(offer)return {facility,offer};}return null;}
