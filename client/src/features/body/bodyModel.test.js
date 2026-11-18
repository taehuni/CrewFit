import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyChart,bodyDifference,bodyPayload} from './bodyModel.js';
test('chart uses elapsed dates, omits absent measurements and keeps real zero values',()=>{
 const rows=[{id:'1',measured_on:'2026-11-01',weight_kg:60},{id:'2',measured_on:'2026-11-02',weight_kg:61},{id:'3',measured_on:'2026-11-11',weight_kg:62},{id:'4',measured_on:'2026-11-12',weight_kg:null}];
 const {points}=bodyChart(rows,'weight_kg');assert.equal(points.length,3);assert.ok(Math.abs((points[1].x-points[0].x)/(points[2].x-points[0].x)-.1)<1e-8);
 assert.equal(bodyChart([{id:'0',measured_on:'2026-11-01',body_fat_percent:0}],'body_fat_percent').points.length,1);
});
test('comparison never interprets a missing value as zero and percent changes are percentage points',()=>{
 assert.equal(bodyDifference({body_fat_percent:20},{body_fat_percent:21},'body_fat_percent'),-1);
 assert.equal(bodyDifference({skeletal_muscle_kg:null},{skeletal_muscle_kg:30},'skeletal_muscle_kg'),null);
 assert.equal(bodyDifference({weight_kg:70.1},{weight_kg:70},'weight_kg'),.1);
});
test('form optional blanks become null, while entered zero is preserved',()=>{
 const values=bodyPayload({weight_kg:'70.5',skeletal_muscle_kg:'',body_fat_percent:'0'});assert.equal(values.weight_kg,70.5);assert.equal(values.skeletal_muscle_kg,null);assert.equal(values.body_fat_percent,0);
});
