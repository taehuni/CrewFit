import {readReport,reportSections} from './report.js';
const titles = {'현재 상태':'기록 요약','잘한 점':'잘한 점','개선할 점':'다음에 살펴볼 점','다음 행동':'다음 운동 가이드'};
const sports={running:'러닝',walking:'걷기',cycling:'자전거',swimming:'수영',gym:'헬스',other:'기타 운동'};
function ReportSummary({report}) {
  const max=Math.max(1,...report.sports.map(row=>row.seconds));
  return <div className="report-summary">
    <header><span>MY MOVEMENT REPORT</span><h3>숫자로 보는 나의 운동</h3><p>분석 당시 입력된 기록 기준 · {report.range.from} — {report.range.to}</p></header>
    <dl className="report-metrics">{[['운동 기록',`${report.activityCount}회`],['총 운동 시간',report.totalTime],['운동한 날짜',`${report.activeDays}일`],['식사 기록',`${report.mealCount}건`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <section className="report-sports"><h3>종목별 운동 시간</h3>{report.sports.length?report.sports.map(row=><div className="report-sport" key={row.sport}><div><strong>{sports[row.sport]||row.sport}</strong><span>{row.count}회 · {row.time}{row.distance&&` · ${row.distance}`}</span></div><div className="report-bar" aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,row.seconds/max*100))}%`}}/></div></div>):<p>이 기간에 입력된 운동 기록은 없어요.</p>}<p className="report-data-note">운동 시간의 분포예요. 체력이나 운동 강도를 평가한 점수가 아니에요.</p></section>
  </div>;
}
function Advice({text}) {
  return <div className="report-advice">{text.split(/\n+/).filter(Boolean).map((line,i)=>{
    const match=line.match(/^(운동명|추천 이유|준비|본운동|마무리|강도|조절)\s*[:：]\s*(.*)$/);
    return match?<div className="report-instruction" key={i}><strong>{match[1]}</strong><p>{match[2]}</p></div>:<p key={i}>{line}</p>;
  })}</div>;
}
export default function FeedbackContent({content,report}) {
  const decoded=readReport(content), summary=report||decoded.report, parts=reportSections(decoded.content);
  return <div className="movement-report">{summary&&<ReportSummary report={summary}/>}{!summary&&<p className="report-legacy-note">이전에 받은 코칭이에요. 새로 생성하는 리포트부터 기록 수치가 함께 표시돼요.</p>}
    {parts?<div className="feedback-sections">{parts.map((part,index)=><section key={part.title} className={index===3?'feedback-next-step':''}><span className="feedback-section-number">0{index+1}</span><h3>{titles[part.title]}</h3>{index===3?<Advice text={part.text}/>:<p>{part.text}</p>}</section>)}</div>:<div className="feedback-content">{decoded.content}</div>}
  </div>;
}
