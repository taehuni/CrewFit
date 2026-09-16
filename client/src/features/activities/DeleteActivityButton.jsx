import { useEffect, useRef, useState } from 'react';
import { Button, FormMessage } from '../../shared/ui.jsx';

export default function DeleteActivityButton({ onDelete }) {
  const dialog = useRef(null);
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const preventBusyEscape = event => {
      if (event.key === 'Escape' && lock.current) event.preventDefault();
    };
    window.addEventListener('keydown', preventBusyEscape, true);
    return () => window.removeEventListener('keydown', preventBusyEscape, true);
  }, [open]);
  async function confirm() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await onDelete();
      dialog.current?.close();
    } catch (error) {
      setMessage(error.code === 'not_found'
        ? '기록이 이미 삭제되었거나 삭제할 수 없어요. 취소 후 목록을 확인해 주세요.'
        : '삭제 결과를 확인하지 못했어요. 연결을 확인한 뒤 목록을 새로고침해 주세요.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return <>
    <Button variant="ghost" className="activity-delete-open" onClick={() => { setMessage(''); setOpen(true); }}>삭제</Button>
    {open && <dialog ref={dialog} className="activity-delete-dialog" aria-labelledby="delete-activity-title"
      onCancel={event => { if (lock.current) event.preventDefault(); }}
      onClose={() => setOpen(false)}>
      <h2 id="delete-activity-title">운동 기록을 삭제할까요?</h2>
      <p>이 기록과 연결된 세트·경로가 함께 삭제되며 되돌릴 수 없어요. 게시글은 남지만 기록 첨부는 해제됩니다.</p>
      <FormMessage>{message}</FormMessage>
      <div className="activity-delete-actions">
        <Button variant="ghost" autoFocus disabled={busy} onClick={() => dialog.current?.close()}>취소</Button>
        <Button className="activity-delete-confirm" disabled={busy} onClick={confirm}>{busy ? '삭제 중…' : '기록 삭제'}</Button>
      </div>
    </dialog>}
  </>;
}
