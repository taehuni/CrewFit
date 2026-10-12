export function openCoachChat() {
  window.dispatchEvent(new CustomEvent('crewfit:coach-chat'));
}
