// 두 기능 이상이 똑같이 쓰는 부품만 (D-14 승격 규칙). 스타일은 styles.css.

export function Button({ variant = 'primary', block, size, className = '', ...props }) {
  const cls = ['btn', `btn-${variant}`, block && 'btn-block', size && `btn-${size}`, className]
    .filter(Boolean)
    .join(' ');
  return <button type="button" className={cls} {...props} />;
}

// label + input + 힌트/에러. 에러가 있으면 aria-invalid + aria-describedby 연결.
export function Field({ id, label, labelAction, hint, error, ...input }) {
  const descId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        {labelAction && <span className="field-label-action">{labelAction}</span>}
      </div>
      <input id={id} aria-invalid={error ? 'true' : undefined} aria-describedby={descId} {...input} />
      {error ? (
        <p id={`${id}-error`} className="field-error">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

// 폼 상단/하단 결과 메시지. 비어 있으면 CSS가 숨김. aria-live로 비동기 결과 알림.
export function FormMessage({ tone = 'error', children }) {
  return (
    <p className="form-msg" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
      {children}
    </p>
  );
}

const SPORT = { running: '러닝', walking: '걷기', cycling: '자전거', swimming: '수영', gym: '헬스', other: '기타' };
const LEVEL = { beginner: '입문', intermediate: '중급', advanced: '상급' };
export const SPORT_LABEL = SPORT;
export const LEVEL_LABEL = LEVEL;

// 사용자 id(uuid) → 3자리 배번. 표시용일 뿐 고유성은 보장하지 않음 (충돌해도 무해).
export function bibNumber(userId = '') {
  return String(parseInt(userId.replace(/-/g, '').slice(-4), 16) % 1000 || 0).padStart(3, '0');
}

// 프로필 카드 — 레이스 배번표. 흰 카드 + 안전핀 구멍 + 종목색 하단 스트라이프 + 배번.
// 종목이 달라도 같은 틀(다종목 서비스). 랜딩(예시)·홈·나 화면·회원 페이지에서 같은 모양.
export function ProfileCard({ nickname, sport, level, region, number = '000', as: Tag = 'section', ...rest }) {
  return (
    <Tag className="bib" data-sport={sport || 'none'} aria-label={`${nickname} 배번표 ${number}번`} {...rest}>
      <p className="bib-head" translate="no"><span>CrewFit</span><span className="num">{number}</span></p>
      <p className="bib-name" translate="no">{nickname}</p>
      <p className="bib-meta">
        <span>{SPORT[sport] || '주종목 미설정'}</span>
        <span>{LEVEL[level] || '레벨 미설정'}</span>
        {region && <span>{region}</span>}
      </p>
      <span className="bib-stripe" aria-hidden="true" />
    </Tag>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
