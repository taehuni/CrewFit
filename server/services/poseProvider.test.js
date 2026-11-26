import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPoseDecision} from './poseProvider.js';

const payload = {model: 'gpt-6-luna', questions: [
  {type: 'predicate', name: 'moving'},
  {type: 'choice', name: 'exercise', choices: [{value: 'squat'}, {value: 'unknown'}]},
]};
const answer = () => ({answers: [
  {type: 'predicate', name: 'moving', probability: .99},
  {type: 'choice', name: 'exercise', choice: 'squat', confidence: .99, probabilities: [{value: 'squat', probability: .99}, {value: 'unknown', probability: .01}]},
]});
const request = fetchImpl => requestPoseDecision({payload, key: 'mock-secret-key', fetchImpl});
const good = data => async () => ({ok: true, json: async () => data});

test('permanent provider access/model/request failures are distinct from temporary outages', async () => {
  for (const status of [400, 401, 403, 404, 422]) {
    await assert.rejects(request(async () => ({ok: false, status, json: async () => ({error: {message: 'mock-secret-key private image details'}})})), error => {
      assert.equal(error.status, 503); assert.equal(error.code, 'analysis_unavailable');
      assert.doesNotMatch(error.message, /mock-secret|private image/); return true;
    });
  }
  for (const status of [408, 429, 500, 502, 503, 504]) {
    await assert.rejects(request(async () => ({ok: false, status, json: async () => ({error: {code: 'rate_limit_exceeded'}})})), {status: 502, code: 'analysis_temporary_failure'});
  }
});

test('quota exhaustion is not treated as an endlessly retryable provider rate limit', async () => {
  for (const code of ['insufficient_quota', 'billing_hard_limit_reached']) {
    await assert.rejects(request(async () => ({ok: false, status: 429, json: async () => ({error: {code, message: 'private account details'}})})), {status: 503, code: 'analysis_unavailable'});
  }
  await assert.rejects(request(async () => ({ok: false, status: 404, json: async () => {throw new SyntaxError('private HTML');}})), {status: 503, code: 'analysis_unavailable'});
});

test('network failures and timeouts remain temporary and never expose raw provider errors', async () => {
  await assert.rejects(request(async () => {throw new Error('mock-secret-key private request body');}), error => error.code === 'analysis_temporary_failure' && !/mock-secret|private/.test(error.message));
  let aborted = false;
  await assert.rejects(requestPoseDecision({payload, key: 'mock-only', timeoutMs: 5, fetchImpl: async (url, {signal}) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => {aborted = true; reject(new Error('private timeout'));}, {once: true});
  })}), {status: 502, code: 'analysis_temporary_failure'});
  assert.equal(aborted, true);
});

test('HTTP success with incomplete/malformed answers is a service error, not an uncertain movement', async () => {
  const malformed = [null, {}, {answers: []}, {...answer(), status: 'incomplete'}, {...answer(), status: 'failed'}];
  for (const change of [
    data => data.answers.pop(),
    data => data.answers.push(data.answers[0]),
    data => {data.answers[0].name = 'unexpected';},
    data => {data.answers[0].type = 'score';},
    data => {data.answers[0].probability = NaN;},
    data => {data.answers[1].choice = 'invented';},
    data => {data.answers[1].confidence = 2;},
    data => {data.answers[1].probabilities.pop();},
    data => {data.answers[1].probabilities[1].value = 'squat';},
    data => {data.answers[1].probabilities[1].probability = .5;},
  ]) {const data = answer(); change(data); malformed.push(data);}
  for (const data of malformed) await assert.rejects(request(good(data)), {status: 502, code: 'analysis_invalid_response'});
  await assert.rejects(request(async () => ({ok: true, json: async () => {throw new SyntaxError('private body');}})), {status: 502, code: 'analysis_invalid_response'});
});

test('valid uncertainty and per-question refusals stay ordinary results without relaxing confidence', async () => {
  const uncertain = answer(); uncertain.answers[0].probability = .1;
  uncertain.answers[1].confidence = .5; uncertain.answers[1].probabilities.forEach(row => {row.probability = .5;});
  assert.deepEqual(await request(good(uncertain)), uncertain);
  const refused = answer(); refused.answers[0] = {type: 'refusal', name: 'moving'};
  assert.deepEqual(await request(good(refused)), refused);
  assert.deepEqual(await request(good({...answer(), status: 'completed'})), {...answer(), status: 'completed'});
});
