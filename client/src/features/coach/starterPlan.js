export function firstWeekLabel(date, weeks=1) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return '';
  const start=new Date(date+'T00:00:00Z');
  if(!Number.isFinite(start.getTime()))return '';
  const end=new Date(start);end.setUTCDate(end.getUTCDate()+Number(weeks)*7-1);
  return `${start.getUTCMonth()+1}월 ${start.getUTCDate()}일 — ${end.getUTCMonth()+1}월 ${end.getUTCDate()}일`;
}
export function starterContext(message='') {
  const weeks=message.match(/^처음 운동을 시작하려고 해요\. 아래 선택을 바탕으로 (1|2|4)주 입문 계획/);
  const date=message.match(/시작 날짜: (\d{4}-\d{2}-\d{2})/);
  return weeks&&date?{weeks:Number(weeks[1]),date:date[1],range:firstWeekLabel(date[1],weeks[1])}:null;
}
export function starterPrompt(form) {
  if(!form.days.length)throw new Error('운동 가능한 요일을 하나 이상 골라 주세요.');
  return `처음 운동을 시작하려고 해요. 아래 선택을 바탕으로 ${form.weeks}주 입문 계획을 함께 설계해 주세요.
하고 싶은 운동: ${form.sport}
운동 목적: ${form.goal}
운동 장소: ${form.place}
경험: 처음 시작하는 초보자
한 번에 가능한 시간: ${form.minutes}분
시작 날짜: ${form.date} (한국시간)
가능한 요일: ${form.days.join(', ')}
시작 시각: ${form.time}
고려할 점: ${form.note.trim()||'아직 따로 적은 내용 없음'}
답변은 “전체 계획 방향”과 “주차별 실천 안내”로 구분해 주세요. 선택한 ${form.weeks}주 전체의 각 주차별 방향을 설명하고, plans에는 시작 날짜부터 ${Number(form.weeks)*7}일 동안 선택한 요일의 모든 일정을 빠짐없이 넣어 주세요(최대 28개). 1일 1개 일정이며 선택한 기간 밖의 일정은 넣지 마세요. 구체적인 운동 방법과 쉬는 시간을 메모에 설명하고 준비·정리 운동까지 포함해 한 번에 가능한 시간을 넘기지 마세요. 운동량을 매주 자동으로 늘리지 마세요. 정보가 부족하면 먼저 질문해 주세요. 계획과 달력 저장은 제가 확인한 다음에 할게요.`;
}
export function proposalWeek(date, start) {
 return Math.max(1,Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/604800000)+1);
}
