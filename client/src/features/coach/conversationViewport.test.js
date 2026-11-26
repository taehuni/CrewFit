import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationKeyboardOpen,conversationPanelHeight} from './conversationViewport.js';

test('keyboard layout requires editing and a reduced unzoomed visual viewport',()=>{
 const screen={layoutHeight:844,viewportHeight:450,editing:true,scale:1};
 assert.equal(conversationKeyboardOpen(screen),true);
 assert.equal(conversationKeyboardOpen({...screen,scale:2}),false);
 assert.equal(conversationKeyboardOpen({...screen,editing:false}),false);
 assert.equal(conversationKeyboardOpen({...screen,viewportHeight:844}),false);
});

test('short landscape keeps 140px of history and contains toolbar and composer',()=>{
 const height=conversationPanelHeight({available:106,toolbar:74,composer:207});
 assert.equal(height,423);
 assert.ok(height-74-207-2>=140);
});

test('keyboard layout reserves its compact composer, while ordinary screens use available space',()=>{
 assert.equal(conversationPanelHeight({available:380,toolbar:0,composer:145}),380);
 assert.equal(conversationPanelHeight({available:190,toolbar:0,composer:145}),287);
 assert.equal(conversationPanelHeight({available:600,toolbar:74,composer:180}),600);
 assert.equal(conversationPanelHeight({available:2000,toolbar:74,composer:180}),1000);
 assert.equal(conversationPanelHeight({available:200,toolbar:74,composer:0}),216);
});
