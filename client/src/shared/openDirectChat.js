export function openDirectChat(profile) {
  window.dispatchEvent(new CustomEvent('crewfit:direct-chat', {detail:{id:profile.id,nickname:profile.nickname}}));
}
