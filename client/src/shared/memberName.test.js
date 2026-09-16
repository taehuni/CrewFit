import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMemberName } from './memberName.js';

test('앞뒤 공백을 제거하고 한글·외국어·한 글자 이름을 허용한다', () => {
  for (const name of ['김민수', '김', 'Anne-Marie O’Neill', '李 明', 'José']) {
    assert.equal(normalizeMemberName(`  ${name}  `), name);
  }
});
test('비어 있는 이름과 공백뿐인 이름은 거부한다', () => {
  for (const value of ['', '  ', '\u3000', null, undefined]) assert.throws(() => normalizeMemberName(value));
});
test('길이 경계와 제어문자를 검사한다', () => {
  assert.equal(normalizeMemberName('가'.repeat(50)), '가'.repeat(50));
  assert.throws(() => normalizeMemberName('가'.repeat(51)));
  for (const name of ['김\n민수', '김\t민수', '김\u0000민수', '김\u007f민수']) assert.throws(() => normalizeMemberName(name));
});
