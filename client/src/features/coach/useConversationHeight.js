import {useLayoutEffect} from 'react';
import {conversationKeyboardOpen,conversationPanelHeight} from './conversationViewport.js';

// Reserve only the space actually occupied by the surrounding page and fixed
// navigation. visualViewport also follows a mobile browser's on-screen keyboard.
export default function useConversationHeight(pageRef,conversationRef,active){
 useLayoutEffect(()=>{
  const page=pageRef.current,panel=conversationRef.current;
  if(!active||!page||!panel)return;
  const viewport=window.visualViewport;
  let frame;
  const measure=()=>{
   const bottom=(viewport?.offsetTop||0)+(viewport?.height||window.innerHeight);
   const focused=document.activeElement;
   const editing=panel.contains(focused)&&focused?.matches('textarea,input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]),[contenteditable=true]');
   const keyboard=!!viewport&&conversationKeyboardOpen({layoutHeight:window.innerHeight,viewportHeight:viewport.height,scale:viewport.scale,editing});
   page.dataset.keyboardOpen=String(keyboard);
   const nav=page.closest('.workspace')?.querySelector('.ws-nav');
   const navRect=nav?.getBoundingClientRect();
   const navTop=nav&&getComputedStyle(nav).position==='fixed'&&navRect.top<bottom?navRect.top:bottom;
   const top=panel.getBoundingClientRect().top;
   const available=Math.floor(Math.min(bottom,navTop)-Math.max(top,viewport?.offsetTop||0)-12);
   const toolbar=panel.querySelector('.coach-history-toolbar')?.getBoundingClientRect().height||0;
   const composer=panel.querySelector('.coach-composer')?.getBoundingClientRect().height||0;
   panel.style.setProperty('--coach-conversation-height',conversationPanelHeight({available,toolbar,composer})+'px');
   if(keyboard&&panel.contains(document.activeElement)&&top>(viewport?.offsetTop||0)+16&&available<300){
    window.scrollBy({top:top-(viewport?.offsetTop||0)-12,behavior:'instant'});
   }
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  const observer=new ResizeObserver(schedule);
  for(const child of page.children)if(child!==panel.parentElement)observer.observe(child);
  for(const control of panel.querySelectorAll('.coach-history-toolbar,.coach-composer'))observer.observe(control);
  window.addEventListener('resize',schedule);
  window.addEventListener('scroll',schedule,{passive:true});
  document.addEventListener('focusin',schedule);
  document.addEventListener('focusout',schedule);
  viewport?.addEventListener('resize',schedule);
  viewport?.addEventListener('scroll',schedule);
  measure();
  return ()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule);document.removeEventListener('focusin',schedule);document.removeEventListener('focusout',schedule);viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);delete page.dataset.keyboardOpen;};
 },[pageRef,conversationRef,active]);
}
