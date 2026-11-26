export function conversationKeyboardOpen({layoutHeight,viewportHeight,scale=1,editing=false}){
 return editing&&Math.abs(scale-1)<0.05&&layoutHeight-viewportHeight>140;
}

export function conversationPanelHeight({available,toolbar=0,composer=0,reading=140}){
 // In a short landscape/keyboard viewport, let the document scroll rather
 // than compressing history to nothing or overflowing the panel's controls.
 const minimum=Math.ceil(toolbar+composer+reading+2);
 return Math.max(minimum,Math.min(1000,Math.floor(available)));
}
