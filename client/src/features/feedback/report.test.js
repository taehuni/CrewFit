import test from 'node:test';
import assert from 'node:assert/strict';
import {readReport,reportSections} from './report.js';
test('report reader supports saved snapshots and legacy text',()=>{
 const value={format:'crewfit-report-v1',analysis:'분석',summary:{sports:[]}};
 assert.deepEqual(readReport(JSON.stringify(value)),{content:'분석',report:value.summary});
 assert.deepEqual(readReport('기존 내용'),{content:'기존 내용',report:null});
 assert.equal(readReport('{invalid').content,'{invalid');
});
test('report sections preserve detailed session steps and unknown output',()=>{
 const parts=reportSections('① 현재 상태: 기록\n② 잘한 점: 장점\n③ 개선할 점: 조절\n④ 다음 행동: 운동명: 걷기\n준비: 5분');
 assert.equal(parts.length,4);assert.match(parts[3].text,/준비: 5분/);
 assert.equal(reportSections('자유로운 답변'),null);
});
