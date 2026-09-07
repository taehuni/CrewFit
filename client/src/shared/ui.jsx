// 두 기능 이상이 똑같이 쓰는 부품만 (D-14 승격 규칙). 스타일은 styles.css.

export function Button({ variant = 'primary', block, size, className = '', ...props }) {
  const cls = ['btn', `btn-${variant}`, block && 'btn-block', size && `btn-${size}`, className]
    .filter(Boolean)
    .join(' ');
  return <button type="button" className={cls} {...props} />;
}

// label + input + 힌트/에러. 에러가 있으면 aria-invalid + aria-describedby 연결.
export function Field({ id, label, hint, error, ...input }) {
  const descId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
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

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
