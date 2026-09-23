import test from 'node:test';
import assert from 'node:assert/strict';
import { coachingModel, DEFAULT_OPENAI_MODEL, generateCoaching, requireFeedbackConfig } from './llm.js';
import { COACHING_INSTRUCTIONS } from './coachingInstructions.js';

test('model defaults safely and can be changed by server environment', () => {
  assert.equal(coachingModel({}), DEFAULT_OPENAI_MODEL);
  assert.equal(coachingModel({ OPENAI_MODEL: ' custom-model ' }), 'custom-model');
  assert.deepEqual(requireFeedbackConfig({ SUPABASE_SERVICE_ROLE_KEY: 'service', OPENAI_API_KEY: 'secret', OPENAI_MODEL: 'model' }), { model: 'model' });
  assert.throws(() => requireFeedbackConfig({ OPENAI_API_KEY: 'secret' }), /SUPABASE_SERVICE_ROLE_KEY/);
  assert.throws(() => requireFeedbackConfig({ SUPABASE_SERVICE_ROLE_KEY: 'service' }), /OPENAI_API_KEY/);
});

test('OpenAI request keeps the key in headers, disables response storage and returns text blocks', async () => {
  const calls = [];
  const result = await generateCoaching('기록', { apiKey: 'server-secret', model: 'model-v1', signal: undefined,
    fetchImpl: async (...args) => { calls.push(args); return { ok: true, json: async () => ({ model: 'resolved-model', status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: ' 첫 문단 ' }, { type: 'output_text', text: '둘째 문단' }] }] }) }; } });
  assert.deepEqual(result, { content: '첫 문단\n\n둘째 문단', model: 'resolved-model' });
  assert.equal(calls[0][0], 'https://api.openai.com/v1/responses');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer server-secret');

  const body = JSON.parse(calls[0][1].body);
  assert.equal(body.model, 'model-v1'); assert.equal(body.input[0].content, '기록');
  assert.equal(body.instructions, COACHING_INSTRUCTIONS);
  assert.equal(body.store, false); assert.equal(body.max_output_tokens, 1600);
  assert.equal('temperature' in body, false); assert.equal('top_p' in body, false); assert.equal('top_k' in body, false);
});

test('OpenAI transport, HTTP, refusal and empty responses expose only stable application errors', async () => {
  await assert.rejects(generateCoaching('x', { apiKey: '', fetchImpl: async () => {} }), error => error.code === 'CONFIG_REQUIRED');
  await assert.rejects(generateCoaching('x', { apiKey: 'key', signal: undefined, fetchImpl: async () => { throw new Error('private network'); } }), error => error.code === 'LLM_FAILED' && !error.message.includes('private'));
  await assert.rejects(generateCoaching('x', { apiKey: 'key', signal: undefined, fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: 'private' }) }) }), error => error.code === 'LLM_FAILED');
  await assert.rejects(generateCoaching('x', { apiKey: 'key', signal: undefined, fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'private' }] }] }) }) }), error => error.code === 'LLM_REFUSED');
  await assert.rejects(generateCoaching('x', { apiKey: 'key', signal: undefined, fetchImpl: async () => ({ ok: true, json: async () => ({ content: [] }) }) }), error => error.code === 'LLM_FAILED');
});

test('incomplete responses are rejected even when they contain partial text', async () => {
  await assert.rejects(generateCoaching('x', { apiKey: 'key', fetchImpl: async () => ({ ok: true,
    json: async () => ({ status: 'incomplete', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '잘린 답' }] }] }),
  }) }), error => error.code === 'LLM_FAILED');
});
