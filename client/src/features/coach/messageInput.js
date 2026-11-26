export function shouldSubmitChatOnEnter(event, mobile) {
  const native = event.nativeEvent || event;
  if (mobile || event.key !== 'Enter' || event.shiftKey) return false;
  // Some IMEs report Enter with keyCode 229 after compositionend.
  if (event.isComposing || native.isComposing || event.keyCode === 229 || native.keyCode === 229) return false;
  return true;
}
