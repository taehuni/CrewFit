import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { trackingHandoffUrl } from './device.js';
import './phone-handoff.css';

export default function GpsPhoneDialog({ onClose, sport = '' }) {
  const dialog = useRef(null);
  const [copied, setCopied] = useState('');
  const url = trackingHandoffUrl(window.location.origin, sport);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    node.showModal();
    return () => { node.close(); previous?.focus?.(); };
  }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied('주소를 복사했어요.'); }
    catch { setCopied('아래 주소를 선택해서 복사해 주세요.'); }
  }
  return <dialog ref={dialog} className="gps-phone-dialog" aria-labelledby="gps-phone-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="gps-phone-content">
      <button type="button" className="gps-phone-close" aria-label="안내 닫기" autoFocus onClick={onClose}>×</button>
      <span className="gps-phone-eyebrow">CONTINUE ON MOBILE</span>
      <h2 id="gps-phone-title">휴대폰으로 이어서<br/>측정하세요</h2>
      <p>GPS 운동 측정은 휴대폰에서 이용해 주세요.<br/>PC에서는 기록 입력과 경로 확인이 가능해요.</p>
      <div className="gps-phone-qr"><QRCodeSVG value={url} size={188} marginSize={4} level="M" title="휴대폰 GPS 측정 페이지 접속 QR코드"/></div>
      <ol><li>휴대폰 카메라로 QR코드를 스캔하세요.</li><li>로그인 후 종목을 선택하세요.</li><li>위치 권한을 허용하고 측정을 시작하세요.</li></ol>
      <button type="button" className="btn btn-primary" onClick={copy}>접속 주소 복사</button>
      <p className="gps-phone-url">{url}</p>
      <p className="gps-phone-status" role="status">{copied}</p>
      <small>측정 중에는 화면을 켜고 이 탭을 유지해 주세요.</small>
    </div>
  </dialog>;
}
