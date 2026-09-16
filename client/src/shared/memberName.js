// 실명은 본인 입력값이다. 특정 언어/성씨 형식을 강제하지 않는다.
export function normalizeMemberName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw new Error('이름을 입력해 주세요.');
  if ([...name].length > 50) throw new Error('이름은 50자 이내로 입력해 주세요.');
  if (/[\u0000-\u001f\u007f]/u.test(name)) throw new Error('이름에 줄바꿈이나 제어문자를 넣을 수 없어요.');
  return name;
}
