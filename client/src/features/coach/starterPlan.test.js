import test from 'node:test';
import assert from 'node:assert/strict';
import {starterPrompt,firstWeekLabel,starterContext,proposalWeek} from './starterPlan.js';
test('첫 상담은 가능한 요일이 없으면 전송하지 않는다',()=>{assert.throws(()=>starterPrompt({days:[]}),/요일/);});
test('선택한 기간·요일·제약을 보존하고 전체 기간을 저장 가능하도록 요청한다',()=>{const message=starterPrompt({sport:'러닝',goal:'습관',place:'야외',minutes:'20',weeks:'4',days:['월','수'],date:'2026-10-26',time:'19:00',note:'야근으로 짧게'});for(const value of ['4주','월, 수','20분','2026-10-26','19:00','야근으로 짧게','28일','제가 확인'])assert.ok(message.includes(value));assert.ok(message.length<=2000);});

test('첫 주 안내는 월·연도 경계에서도 7일이며 입문 대화만 구분한다',()=>{
 assert.equal(firstWeekLabel('2026-12-29'),'12월 29일 — 1월 4일');
 assert.equal(starterContext('일반 운동 질문'),null);
 const message=starterPrompt({sport:'걷기',goal:'습관',place:'야외',minutes:'20',weeks:'2',days:['월'],date:'2026-10-26',time:'19:00',note:''});
 assert.deepEqual(starterContext(message),{weeks:2,date:'2026-10-26',range:'10월 26일 — 11월 8일'});
 assert.match(message,/전체 계획 방향/);assert.match(message,/주차별 실천 안내/);
});

test('4주 범위와 주차 구분은 연도 경계를 처리한다',()=>{assert.equal(firstWeekLabel('2026-12-29',4),'12월 29일 — 1월 25일');assert.equal(proposalWeek('2027-01-05','2026-12-29'),2);assert.equal(proposalWeek('2027-01-25','2026-12-29'),4);});
