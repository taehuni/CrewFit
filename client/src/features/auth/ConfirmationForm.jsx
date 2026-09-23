import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../shared/supabaseClient.js';
import { Button, Field, FormMessage } from '../../shared/ui.jsx';
import { authMessage } from './AuthLayout.jsx';
import { resendConfirmation } from './authLinks.js';

export default function ConfirmationForm({ initialEmail = '', initiallySent = false }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(initiallySent);
  const [seconds, setSeconds] = useState(initiallySent ? 60 : 0);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!seconds) return;
    const timer = setTimeout(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current || seconds > 0) return;
    inFlight.current = true; setBusy(true); setError(''); setSent(false);
    try {
      await resendConfirmation(supabase.auth, email, window.location.origin);
      setSent(true); setSeconds(60);
    } catch (err) {
      setError(authMessage(err));
      if (err.status === 429) setSeconds(60);
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <form className="form" onSubmit={submit}>
    {sent && <FormMessage tone="ok">인증 메일을 확인해 주세요. 메일이 없다면 스팸함도 확인하고, 여러 통을 받았다면 가장 최근 링크를 열어 주세요. 이미 인증한 계정은 로그인할 수 있어요.</FormMessage>}
    <Field id="confirmation-email" label="가입한 이메일" name="email" type="email" autoComplete="email" required
      value={email} onChange={event => { setEmail(event.target.value); setSent(false); }} />
    <FormMessage>{error}</FormMessage>
    <Button type="submit" block disabled={busy || seconds > 0}>{busy ? '보내는 중…' : seconds > 0 ? `${seconds}초 후 다시 보내기` : '인증 메일 다시 보내기'}</Button>
  </form>;
}
