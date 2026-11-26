import test from 'node:test';
import assert from 'node:assert/strict';
import {authMessage} from './authMessage.js';

test('Korean validation and recovery instructions survive provider error translation', () => {
  const text = '이름은 2자 이상 입력해 주세요.';
  assert.equal(authMessage(new Error(text)), text);
  assert.equal(authMessage(new Error('Google 연결을 시작하지 못했어요. 다시 시도해 주세요.')), 'Google 연결을 시작하지 못했어요. 다시 시도해 주세요.');
});

test('known account errors retain a specific recovery action', () => {
  assert.match(authMessage({code:'email_not_confirmed',message:'Email not confirmed'}), /인증 링크/);
  assert.match(authMessage(new Error('Invalid login credentials')), /이메일 또는 비밀번호/);
  assert.match(authMessage(new Error('User already registered')), /로그인/);
  assert.match(authMessage(new Error('Token expired')), /새 메일/);
});

test('transport errors tell the user to retry without exposing raw service messages', () => {
  assert.match(authMessage(new TypeError('Failed to fetch')), /인터넷 연결/);
  assert.match(authMessage(new Error('Network request failed while refreshing session')), /인터넷 연결/);
  assert.match(authMessage({name:'TimeoutError',message:'The operation was aborted due to timeout'}), /지연/);
  const unknown = 'upstream_internal: unsupported grant configuration';
  const output = authMessage(new Error(unknown));
  assert.match(output, /다시 시도/);
  assert.equal(output.includes(unknown), false);
  assert.equal(authMessage(), output);
  assert.equal(authMessage({message:{unexpected:true}}), output);
});
