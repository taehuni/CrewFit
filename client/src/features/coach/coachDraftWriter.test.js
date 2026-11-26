import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoachDraftWriter } from './coachDraftWriter.js';
test('late account A answer cannot clear the current B draft or a later A draft', () => {
  const questions = new Map(), writer = createCoachDraftWriter({ write(owner, message) { questions.set(owner, message); return true; } });
  const firstA = writer.bind('a'); firstA('A 질문');
  const currentB = writer.bind('b'); currentB('B 질문');
  assert.equal(firstA(''), null);
  assert.equal(questions.get('b'), 'B 질문');
  const laterA = writer.bind('a'); laterA('다시 작성한 A 질문');
  assert.equal(firstA(''), null);
  assert.equal(questions.get('a'), '다시 작성한 A 질문');
});
test('late answer after page exit does not mutate a restored draft', () => {
  let question = '';
  const writer = createCoachDraftWriter({ write(owner, message) { question = message; return true; } });
  const send = writer.bind('a'); send('질문'); writer.dispose();
  assert.equal(send(''), null); assert.equal(question, '질문');
  writer.activate(); assert.deepEqual(writer.bind('a')('수정 질문'), { kept: true });
});
