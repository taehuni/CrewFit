import test from 'node:test';
import assert from 'node:assert/strict';
import { isMobileTrackingDevice, trackingHandoffUrl } from './device.js';
test('phones and desktop-mode iPads can track, desktop touch screens cannot', () => {
  for (const userAgent of ['iPhone', 'Android', 'iPad']) assert.equal(isMobileTrackingDevice({userAgent}), true);
  assert.equal(isMobileTrackingDevice({userAgent:'Macintosh',maxTouchPoints:5}), true);
  assert.equal(isMobileTrackingDevice({userAgent:'Windows NT',maxTouchPoints:10}), false);
  assert.equal(isMobileTrackingDevice({userAgent:'Macintosh',maxTouchPoints:0}), false);
  assert.equal(isMobileTrackingDevice({}), false);
});
test('handoff shares only the tracking URL and uses the deployed site for local development', () => {
  assert.equal(trackingHandoffUrl('http://localhost:5173','running'),'https://crewfit-akvt.onrender.com/activities/track?sport=running');
  assert.equal(trackingHandoffUrl('http://192.168.0.3:5173'),'https://crewfit-akvt.onrender.com/activities/track');
  assert.equal(trackingHandoffUrl('https://crewfit-akvt.onrender.com/path?token=secret#private','bad'),'https://crewfit-akvt.onrender.com/activities/track');
});
