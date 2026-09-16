import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { normalizeMemberName } from '../../shared/memberName.js';
import { Button, Field, FormMessage } from '../../shared/ui.jsx';

export default function RealNameForm({ userId, initialName }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('error');

  async function onSubmit(event) {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    try {
      const real_name = normalizeMemberName(name);
      const { data, error } = await supabase.from('user_settings')
        .update({ real_name }).eq('user_id', userId).select('real_name').single();
      if (error) throw error;
      queryClient.setQueryData(queryKeys.me(userId), (me) => me && ({
        ...me, settings: { ...me.settings, real_name: data.real_name },
      }));
      setName(data.real_name);
      setTone('ok');
      setMessage('이름을 저장했어요.');
    } catch (error) {
      setTone('error');
      setMessage(['42703', 'PGRST204'].includes(error.code)
        ? '이름 저장 기능의 DB 설정이 아직 적용되지 않았어요. 관리자에게 알려 주세요.'
        : error.message || '이름을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" aria-labelledby="member-name-heading">
      <h2 id="member-name-heading">크루에서 알아볼 이름</h2>
      <form className="form" onSubmit={onSubmit}>
        <Field id="member-real-name" label="이름 (실명)" name="real_name" autoComplete="name"
          value={name} onChange={(event) => { setName(event.target.value); setMessage(''); }}
          maxLength={50} required disabled={busy}
          hint="본인과 가입이 승인된 크루의 크루장만 볼 수 있어요. 공개 프로필에는 닉네임이 표시돼요." />
        <FormMessage tone={tone}>{message}</FormMessage>
        <Button type="submit" disabled={busy}>{busy ? '저장 중…' : '이름 저장'}</Button>
      </form>
    </section>
  );
}
