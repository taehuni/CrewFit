import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldSubmitChatOnEnter} from './messageInput.js';
import {isMobileTrackingDevice} from '../tracking/device.js';

test('desktop Enter submits and Shift+Enter remains a newline', () => {
  assert.equal(shouldSubmitChatOnEnter({key:'Enter'}, false), true);
  assert.equal(shouldSubmitChatOnEnter({key:'Enter',shiftKey:true}, false), false);
  assert.equal(shouldSubmitChatOnEnter({key:'a'}, false), false);
});

test('phone and tablet Enter remains a newline without depending on window width', () => {
  for (const device of [
    {userAgent:'iPhone'},
    {userAgent:'Android'},
    {userAgent:'Macintosh',maxTouchPoints:5},
  ]) assert.equal(shouldSubmitChatOnEnter({key:'Enter'}, isMobileTrackingDevice(device)), false);
  assert.equal(shouldSubmitChatOnEnter({key:'Enter'}, isMobileTrackingDevice({userAgent:'Windows NT 10.0',maxTouchPoints:0})), true);
});

test('Korean composition and keyCode 229 never submit a partial message', () => {
  for (const event of [
    {key:'Enter',isComposing:true},
    {key:'Enter',nativeEvent:{isComposing:true}},
    {key:'Enter',keyCode:229},
    {key:'Enter',nativeEvent:{keyCode:229,isComposing:false}},
  ]) assert.equal(shouldSubmitChatOnEnter(event, false), false);
  assert.equal(shouldSubmitChatOnEnter({key:'Enter',nativeEvent:{keyCode:13,isComposing:false}}, false), true);
});
