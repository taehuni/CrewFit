export const authPhotos = [
  { src: '/images/auth-runner.jpg', position: '42% center' },
  { src: '/images/auth-gym.jpg', position: '48% center' },
  { src: '/images/auth-city-run.jpg', position: '80% center' },
  { src: '/images/auth-strength.jpg', position: '55% center' },
  { src: '/images/auth-cycling.jpg', position: '43% center' },
];

// Exclude the previous opening shot, not the previous slideshow frame.
export function chooseStartPhoto(previousSrc, random = Math.random) {
  const candidates = authPhotos.map((photo, index) => index)
    .filter(index => authPhotos[index].src !== previousSrc);
  return candidates[Math.floor(random() * candidates.length)];
}
