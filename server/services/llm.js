import { requiredEnv } from '../config/env.js';
import { COACHING_INSTRUCTIONS } from './coachingInstructions.js';

export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

export function coachingModel(env = process.env) {
  return env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export function requireFeedbackConfig(env = process.env) {
  requiredEnv('SUPABASE_SERVICE_ROLE_KEY', env);
  requiredEnv('OPENAI_API_KEY', env);
  return { model: coachingModel(env) };
}

const reportSchema={type:'object',additionalProperties:false,required:['current','strength','consideration','next','session'],properties:{
  current:{type:'string'},strength:{type:'string'},consideration:{type:'string'},next:{type:'string'},
  session:{anyOf:[{type:'null'},{type:'object',additionalProperties:false,required:['title','reason','intensity','adjustment','steps'],properties:{
    title:{type:'string'},reason:{type:'string'},intensity:{type:'string'},adjustment:{type:'string'},
    steps:{type:'array',minItems:3,maxItems:3,items:{type:'object',additionalProperties:false,required:['minutes','details'],properties:{minutes:{type:'integer',minimum:1,maximum:60},details:{type:'string'}}}}
  }}]}
}};
export function formatReportReply(raw) {
  let value;
  try {value=JSON.parse(raw);} catch {throw Object.assign(new Error('리포트 형식을 확인하지 못했어요.'),{code:'LLM_FAILED'});}
  if(!value || ['current','strength','consideration','next'].some(key=>typeof value[key]!=='string') || !('session' in value)) throw Object.assign(new Error('리포트 항목이 누락됐어요.'),{code:'LLM_FAILED'});
  let next=value.next;
  if(value.session!==null){
    const session=value.session;
    if(!session || ['title','reason','intensity','adjustment'].some(key=>typeof session[key]!=='string') || !Array.isArray(session.steps) || session.steps.length!==3 || session.steps.some(step=>!Number.isInteger(step.minutes)||step.minutes<1||step.minutes>60||typeof step.details!=='string')) throw Object.assign(new Error('운동 제안 형식을 확인하지 못했어요.'),{code:'LLM_FAILED'});
    const total=session.steps.reduce((sum,step)=>sum+step.minutes,0);
    next += `\n운동명: ${session.title} · 총 ${total}분\n추천 이유: ${session.reason}\n`+session.steps.map((step,i)=>`${['준비','본운동','마무리'][i]}: ${step.minutes}분 · ${step.details}`).join('\n')+`\n강도: ${session.intensity}\n조절: ${session.adjustment}`;
  }
  return `① 현재 상태: ${value.current}\n\n② 잘한 점: ${value.strength}\n\n③ 개선할 점: ${value.consideration}\n\n④ 다음 행동: ${next}`;
}

export async function generateCoaching(prompt, {
  apiKey = process.env.OPENAI_API_KEY,
  model = coachingModel(),
  fetchImpl = fetch,
  signal = AbortSignal.timeout(45000),
} = {}) {
  if (!apiKey?.trim()) throw Object.assign(new Error('AI API key is not configured'), { code: 'CONFIG_REQUIRED' });
  let response;
  try {
    response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 2200,
        text:{format:{type:'json_schema',name:'movement_report',strict:true,schema:reportSchema}},
        instructions: COACHING_INSTRUCTIONS,
        input: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (cause) {
    throw Object.assign(new Error('AI 응답을 받지 못했어요.'), { code: 'LLM_FAILED', cause });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error('AI 응답을 받지 못했어요.'), { code: 'LLM_FAILED', status: response.status });
  const blocks = Array.isArray(data?.output) ? data.output
    .filter(item => item?.type === 'message' && item.role === 'assistant')
    .flatMap(item => Array.isArray(item.content) ? item.content : []) : [];
  if (blocks.some(block => block?.type === 'refusal')) throw Object.assign(new Error('이 기록으로는 피드백을 만들 수 없어요.'), { code: 'LLM_REFUSED' });
  if (data?.status !== 'completed') throw Object.assign(new Error('AI 응답이 완료되지 않았어요.'), { code: 'LLM_FAILED' });
  const content = blocks.filter(block => block?.type === 'output_text' && typeof block.text === 'string')
    .map(block => block.text.trim()).filter(Boolean).join('\n\n');
  if (!content) throw Object.assign(new Error('AI 응답 내용이 비어 있어요.'), { code: 'LLM_FAILED' });
  return { content: formatReportReply(content), model: typeof data.model === 'string' ? data.model : model };
}
