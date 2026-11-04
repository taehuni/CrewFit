import test from 'node:test';
import assert from 'node:assert/strict';
import {feedbackCoachPrompt} from './feedbackCoachContext.js';
const content='① 현재 상태: 걷기 2회 · 40분을 기록했어요.\n\n② 잘한 점: 부담을 조절했어요.\n\n③ 개선할 점: 야근 뒤 수면이 부족했다고 기록했어요.\n\n④ 다음 행동: 다음 운동은 가볍게 선택해 보세요.\n운동명: 걷기 · 총 20분\n추천 이유: 짧게 시작해요.\n준비: 3분 · 천천히 걷기\n본운동: 14분 · 편안하게 걷기\n마무리: 3분 · 속도 낮추기\n강도: 대화가 가능한 정도\n조절: 무릎 통증이 있으면 중단하고 쉬어 주세요.';
test('decodes stored JSON and prioritizes recommendations and constraints without serializing report metadata',()=>{
 const prompt=feedbackCoachPrompt({content:JSON.stringify({format:'crewfit-report-v1',analysis:content,summary:{sports:[],range:{from:'2026-11-01',to:'2026-11-07'},private_unused:'do not include'}})});
 for(const value of ['총 20분','준비: 3분','본운동: 14분','마무리: 3분','무릎 통증','야근','2026-11-01'])assert.ok(prompt.includes(value),value);
 assert.ok(!prompt.includes('crewfit-report-v1'));assert.ok(!prompt.includes('private_unused'));assert.ok(prompt.indexOf('무릎 통증')<prompt.indexOf('운동명:'));
 assert.ok(prompt.length<=2000);
});
test('long introductory analysis cannot push a recommendation or final adjustment out of context',()=>{
 const long=content.replace('걷기 2회 · 40분을 기록했어요.',Array.from({length:400},(_,i)=>i+'번째 기록을 요약했어요. ').join('')).replace('부담을 조절했어요.','관찰했어요. '.repeat(300));
 const prompt=feedbackCoachPrompt({content:long});assert.ok(prompt.includes('무릎 통증'));assert.ok(prompt.includes('본운동: 14분'));assert.ok(prompt.includes('일부 긴 내용'));assert.ok(prompt.length<=2000);
});
test('rest recommendation remains rest with no invented workout details',()=>{
 const prompt=feedbackCoachPrompt({content:'① 현재 상태: 1회 기록했어요.\n② 잘한 점: 피로를 알아차렸어요.\n③ 개선할 점: 쉬고 싶다고 기록했어요.\n④ 다음 행동: 오늘은 휴식하고 수면을 확보해 주세요.'});
 assert.ok(prompt.includes('오늘은 휴식하고 수면을 확보해 주세요.'));assert.ok(!prompt.includes('운동명:'));assert.ok(prompt.includes('과거 제약이 지금도 해당하는지'));
});
test('legacy unstructured text retains late constraints and recommendations',()=>{
 const prompt=feedbackCoachPrompt({content:'이번 주 운동을 기록했어요.\n걷기를 선택해 볼 수 있어요.\n시간 부족이 있었으니 가능한 시간을 다시 확인해 주세요.\n통증이 있으면 운동을 중단하세요.'});
 assert.ok(prompt.includes('걷기를 선택'));assert.ok(prompt.includes('운동을 중단하세요.'));assert.ok(prompt.includes('시간 부족'));
});
test('oversized atomic sentences are omitted explicitly rather than cutting a negative constraint',()=>{
 const prompt=feedbackCoachPrompt({content:'① 현재 상태: 기록했어요.\n② 잘한 점: 살펴봤어요.\n③ 개선할 점: 통증 '+ '매우 긴 상황 '.repeat(1000)+'운동하지 마세요.\n④ 다음 행동: 휴식해 주세요.'});
 assert.ok(prompt.length<=2000);assert.ok(prompt.includes('휴식해 주세요.'));assert.ok(prompt.includes('생략'));assert.ok(!prompt.includes('매우 긴 상황'));
});
test('maximum distinct section budgets and missing input respect the message limit',()=>{
 const line=n=>('가'.repeat(n));
 const prompt=feedbackCoachPrompt({content:'① 현재 상태: '+line(160)+'\n② 잘한 점: 좋아요.\n③ 개선할 점: '+line(650)+'\n④ 다음 행동: '+line(950)});
 assert.ok(prompt.length<=2000);assert.ok(feedbackCoachPrompt(null).length<=2000);assert.ok(feedbackCoachPrompt(null).includes('현재 상황'));
});
