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
        max_output_tokens: 1600,
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
  return { content, model: typeof data.model === 'string' ? data.model : model };
}
