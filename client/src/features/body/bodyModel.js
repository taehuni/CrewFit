export const BODY_METRICS=[{key:'weight_kg',label:'체중',unit:'kg'},{key:'skeletal_muscle_kg',label:'골격근량',unit:'kg'},{key:'body_fat_percent',label:'체지방률',unit:'%'}];
export const bodyToday=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
export const bodyNumber=value=>value==null?'—':Number(value).toLocaleString('ko-KR',{maximumFractionDigits:2});
export function bodyForm(row){return {measured_on:row?.measured_on||bodyToday(),weight_kg:row?.weight_kg??'',skeletal_muscle_kg:row?.skeletal_muscle_kg??'',body_fat_percent:row?.body_fat_percent??'',note:row?.note||'',source_label:row?.source_label||''};}
export function bodyPayload(form){return {...form,weight_kg:form.weight_kg===''?null:Number(form.weight_kg),skeletal_muscle_kg:form.skeletal_muscle_kg===''?null:Number(form.skeletal_muscle_kg),body_fat_percent:form.body_fat_percent===''?null:Number(form.body_fat_percent)};}
export function bodyDifference(latest,previous,key){if(latest?.[key]==null||previous?.[key]==null)return null;return Math.round((Number(latest[key])-Number(previous[key]))*100)/100;}
// Positions use elapsed calendar days, not equally spaced measurement indexes.
export function bodyChart(rows,key){
 const points=rows.filter(row=>row[key]!=null&&Number.isFinite(Number(row[key]))).map(row=>({...row,value:Number(row[key]),day:Date.parse(row.measured_on+'T00:00:00Z')})).filter(row=>Number.isFinite(row.day)).sort((a,b)=>a.day-b.day||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id).localeCompare(String(b.id)));
 if(!points.length)return {points:[],min:0,max:1};
 const low=Math.min(...points.map(p=>p.value)),high=Math.max(...points.map(p=>p.value)),padding=Math.max((high-low)*.2,.5),min=Math.max(0,low-padding),max=high+padding;
 const first=points[0].day,last=points.at(-1).day;
 return {min,max,points:points.map(p=>({...p,x:first===last?300:48+(p.day-first)/(last-first)*504,y:174-(p.value-min)/(max-min)*142}))};
}
