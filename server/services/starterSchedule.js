export function starterSchedule(message='') {
 const weeks=message.match(/^처음 운동을 시작하려고 해요\. 아래 선택을 바탕으로 (1|2|4)주 입문 계획/);
 if(!weeks)return null;
 const start=message.match(/^시작 날짜: (\d{4}-\d{2}-\d{2})/m)?.[1];
 const days=message.match(/^가능한 요일: ([월화수목금토일, ]+)$/m)?.[1].split(/,\s*/);
 const minutes=Number(message.match(/^한 번에 가능한 시간: (\d+)분/m)?.[1]);
 const time=message.match(/^시작 시각: (\d{2}:\d{2})/m)?.[1];
 if(!start||!days?.length||!minutes||!time)return null;
 const dates=[];
 for(let i=0;i<Number(weeks[1])*7;i++) {
  const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+i);
  if(days.includes('일월화수목금토'[d.getUTCDay()]))dates.push({date:d.toISOString().slice(0,10),weekday:'일월화수목금토'[d.getUTCDay()],week:Math.floor(i/7)+1});
 }
 return {dates,minutes,time};
}
export function validateStarterSchedule(plans,schedule) {
 if(!schedule||!plans.length)return;
 const dates=new Set(plans.map(p=>p.scheduled_on));
 if(plans.length!==schedule.dates.length||dates.size!==plans.length||!schedule.dates.every(d=>dates.has(d.date))||plans.some(p=>p.start_time!==schedule.time||p.minutes>schedule.minutes))throw new Error('Requested schedule mismatch');
}
