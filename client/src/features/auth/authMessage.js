export function authMessage(error) {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  // Locally validated business errors already explain what the user can fix.
  if (/[가-힣]/.test(message)) return message;
  if (error?.code === 'email_not_confirmed' || /email not confirmed/i.test(message)) return '이메일 인증이 아직 끝나지 않았어요. 받은 메일의 인증 링크를 열어 주세요.';
  if (/invalid login credentials/i.test(message)) return '이메일 또는 비밀번호가 맞지 않아요. 다시 확인해 주세요.';
  if (/already registered|already been registered/i.test(message)) return '이미 가입된 이메일이에요. 로그인해 주세요.';
  if (/password should be at least/i.test(message)) return '비밀번호는 6자 이상이어야 해요.';
  if (/rate limit|too many requests/i.test(message)) return '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.';
  if (error?.name === 'TimeoutError' || /timeout|timed out/i.test(message)) return '연결이 지연되고 있어요. 잠시 후 다시 시도해 주세요.';
  if (/failed to fetch|fetch failed|network|load failed|offline/i.test(message)) return '연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
  if (/session|expired|invalid.*token/i.test(message)) return '링크가 만료됐거나 유효하지 않아요. 새 메일을 요청해 주세요.';
  return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}
