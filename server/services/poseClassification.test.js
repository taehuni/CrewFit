import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {request} from 'node:http';
import {createPoseRouter} from '../routes/pose.js';
import {EXERCISE_CHOICES, MEASUREMENT_VIEWS, createPoseClassifier, interpretDecision, validatePoseFrames, MAX_FRAME_BYTES} from './poseClassification.js';

const jpeg = `data:image/jpeg;base64,${Buffer.from([255,216,255,224,0,0,255,217]).toString('base64')}`;
const body = () => ({consent: true, frames: Array(4).fill(jpeg)});
function decision(choice = 'squat', probability = .96, form = .99) {
  return {answers: [{type: 'choice', name: 'exercise', choice, confidence: .95, probabilities: EXERCISE_CHOICES.map(([value]) => ({value, probability: value === choice ? probability : (1 - probability) / (EXERCISE_CHOICES.length - 1)}))}, {type: 'predicate', name: 'standard_supported_form', probability: form}, viewDecision(choice === 'lunge' ? 'lunge_left' : choice === 'pushup' ? 'pushup_side' : 'squat_side'), {type:'predicate',name:'movement_observed',probability:.99}]};
}
function viewDecision(choice, probability = .98) {return {type:'choice',name:'measurement_view',choice,confidence:.98,probabilities:MEASUREMENT_VIEWS.map(([value])=>({value,probability:value===choice?probability:(1-probability)/(MEASUREMENT_VIEWS.length-1)}))};}
const provider = async () => ({ok: true, json: async () => decision()});
test('validates consent, exact count, canonical base64, JPEG bytes and bounded size', () => {
  assert.equal(validatePoseFrames(body()).length, 4);
  for (const invalid of [{...body(), consent: false}, {...body(), frames: [jpeg]}, {...body(), frames: Array(4).fill('https://example.com/photo.jpg')}, {...body(), frames: Array(4).fill('data:image/jpeg;base64,AAAA')}, {...body(), frames: Array(4).fill(jpeg + '\n')}, {...body(), frames: Array(4).fill(`data:image/jpeg;base64,${Buffer.alloc(MAX_FRAME_BYTES + 1).toString('base64')}`)}]) assert.throws(() => validatePoseFrames(invalid), {status: 400});
});
test('uses Decisions fixed schema and image inputs, returns only controlled fields', async () => {
  const classify = createPoseClassifier({apiKey: () => 'test-only', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/decisions');
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, 'gpt-6-luna');
    assert.equal(payload.input[0].role, 'user');
    assert.equal(payload.input[0].content.filter(p => p.type === 'input_image').length, 4);
    assert.deepEqual(payload.questions[0].choices.map(c => c.value), EXERCISE_CHOICES.map(c => c[0]));
    assert.equal(payload.questions[1].type, 'predicate');
    assert.equal(payload.questions[2].name, 'measurement_view');
    assert.deepEqual(payload.questions[2].choices.map(c=>c.value), MEASUREMENT_VIEWS.map(c=>c[0]));
    assert.equal(payload.questions[3].name, 'movement_observed');
    assert.equal('store' in payload, false);
    return provider();
  }});
  assert.deepEqual(Object.keys(await classify('u', body())), ['exercise', 'label', 'supported', 'selection', 'criteriaId', 'evaluationMode', 'reason']);
});
test('refusal, ambiguous, malformed and unknown answers fail closed', () => {
  for (const data of [null, {}, {answers: [{type: 'refusal'}]}, decision('squat', .65), decision('unknown'), {...decision(), answers: [decision().answers[0], decision().answers[0]]}]) assert.equal(interpretDecision(data).exercise, null);
  const malformed = decision(); malformed.answers[0].probabilities[0].probability = NaN;
  assert.equal(interpretDecision(malformed).exercise, null);
  const lowConfidence = decision(); lowConfidence.answers[0].confidence = .79;
  assert.equal(interpretDecision(lowConfidence).exercise, null);
});
test('unsupported movements and variants cannot enable measurement', () => {
  assert.equal(interpretDecision(decision()).supported, true);
  assert.equal(interpretDecision(decision('squat', .96, .2)).supported, false);
  assert.equal(interpretDecision(decision('forearm_plank')).supported, false);
  assert.equal(interpretDecision(decision('other')).supported, false);
  const missingForm = decision(); missingForm.answers.splice(1,1);
  assert.equal(interpretDecision(missingForm).supported, false);
});
test('all sourced catalogue variants classify without enabling unsupported local counters',()=>{
  assert.equal(EXERCISE_CHOICES.length,51);
  for(const [id] of EXERCISE_CHOICES.filter(([id])=>!['squat','lunge','pushup','other','unknown'].includes(id))){
    const result=interpretDecision(decision(id));
    assert.equal(result.evaluationMode,'vision');assert.equal(result.criteriaId,id);assert.equal(result.supported,false);assert.equal(result.selection,null);
  }
  assert.equal(interpretDecision(decision('other')).evaluationMode,'record-only');
});

test('automatic selection is returned only for the five evaluator configurations', () => {
  for (const [value, exercise, view] of MEASUREMENT_VIEWS.filter(row=>row[1])) {
    const data=decision(exercise);data.answers[2]=viewDecision(value);
    assert.deepEqual(interpretDecision(data).selection,{exercise,view});
    assert.equal(interpretDecision(data).supported,true);
  }
});

test('ambiguous view, anatomical leg, occlusion and exercise/view disagreement block measurement', () => {
  for (const value of ['unknown','unsupported','lunge_left','pushup_side']) {
    const data=decision();data.answers[2]=viewDecision(value);
    assert.equal(interpretDecision(data).supported,false);assert.equal(interpretDecision(data).selection,null);
  }
  for (const mutate of [
    d=>d.answers.splice(2,1),
    d=>d.answers.push(d.answers[2]),
    d=>d.answers[2].confidence=.94,
    d=>d.answers[2].probabilities=viewDecision('squat_side',.94).probabilities,
    d=>d.answers[2].probabilities[0].probability=NaN,
    d=>d.answers[2].probabilities.pop(),
    d=>d.answers[2].probabilities[0]=d.answers[2].probabilities[1],
  ]) {
    const data=decision();mutate(data);
    assert.equal(interpretDecision(data).selection,null);assert.equal(interpretDecision(data).supported,false);
  }
});

test('standing and unclear motion never default to squat or start an evaluator', () => {
  for (const mutate of [d=>d.answers[3].probability=.89,d=>d.answers.pop(),d=>d.answers.push(d.answers[3]),d=>d.answers[3].probability=NaN]) {
    const data=decision();mutate(data);const result=interpretDecision(data);
    assert.equal(result.exercise,null);assert.equal(result.selection,null);assert.equal(result.supported,false);
    assert.doesNotMatch(result.reason,/직접 선택/);
  }
});
test('minute, rolling daily and user-isolated limits', async () => {
  let time = 0;
  const classify = createPoseClassifier({apiKey: () => 'test', fetchImpl: provider, now: () => time});
  await classify('u', body()); await classify('u', body());
  await assert.rejects(classify('u', body()), {status: 429});
  await classify('other', body());
  for (let i = 2; i < 20; i++) {time += 60001; await classify('u', body());}
  time += 60001;
  await assert.rejects(classify('u', body()), {status: 429});
  time += 86400001;
  await classify('u', body());
});
test('single inflight and upstream failures do not expose provider messages', async () => {
  let release;
  const classify = createPoseClassifier({apiKey: () => 'test', fetchImpl: () => new Promise(resolve => {release = resolve;})});
  const first = classify('u', body());
  await assert.rejects(classify('u', body()), {status: 429});
  release({ok: false});
  await assert.rejects(first, {status: 502, code: 'classification_failed'});
  const missing = createPoseClassifier({apiKey: () => ''});
  await assert.rejects(missing('u', body()), {status: 503});
});
test('provider timeout aborts and releases inflight state', async () => {
  let calls = 0;
  const classify = createPoseClassifier({apiKey: () => 'test', timeoutMs: 5, fetchImpl: async (url, {signal}) => {
    calls++;
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('secret provider details')), {once: true}));
  }});
  await assert.rejects(classify('u', body()), {status: 502});
  await assert.rejects(classify('u', body()), {status: 502});
  assert.equal(calls, 2);
});
test('route authenticates before photo parser, scopes errors and accepts authenticated payload', async t => {
  let calls = 0;
  const app = express();
  app.use('/api/pose', createPoseRouter((req, res, next) => {
    if (req.headers.authorization !== 'Bearer test') return res.status(401).json({error: 'unauthorized'});
    req.user = {id: 'u'}; next();
  }, {classify: async (id, input) => {calls++; assert.equal(id, 'u'); validatePoseFrames(input); return interpretDecision(decision());}}));
  app.use(express.json());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/pose/classify`;
  const send = (payload, auth = true) => new Promise((resolve, reject) => {
    const req = request(url, {method: 'POST', headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...(auth ? {Authorization: 'Bearer test'} : {})}}, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', chunk => {text += chunk;});
      res.on('end', () => resolve({status: res.statusCode, headers: {get: name => res.headers[name]}, text: async () => text, json: async () => JSON.parse(text)}));
    });
    req.on('error', reject); req.end(payload);
  });
  assert.equal((await send('{bad secret photo', false)).status, 401);
  const malformed = await send('{bad secret photo');
  assert.equal(malformed.status, 400); assert.equal((await malformed.text()).includes('secret photo'), false);
  assert.equal((await send(JSON.stringify({frames: ['x'.repeat(1100000)]}))).status, 413);
  // Payload larger than global express.json's default 100 KB must reach this scoped parser.
  const input = {...body(), ignored: 'x'.repeat(110000)};
  const response = await send(JSON.stringify(input));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).supported, true); assert.equal(calls, 1);
});
