// Loading skeleton and error state shared by the detail pages.
import s from './DetailStates.module.css';

/** Header-shaped placeholder while the first request is in flight (keeps layout from jumping). */
export function DetailLoading({ wide }: { wide?: boolean }) {
  return (
    <div className={`${s.skeleton} ${wide ? s.wide : ''}`} data-test="detail-loading" aria-busy="true">
      <div className={s.top}>
        <div className={s.art} />
        <div className={s.lines}>
          <div className={s.line} style={{ width: 280, height: 32 }} />
          <div className={s.line} style={{ width: 140 }} />
          <div className={s.line} style={{ width: 110, marginTop: 16 }} />
        </div>
      </div>
      <div className={s.controls}>
        <div className={s.pill} />
        <div className={s.pill} />
      </div>
    </div>
  );
}

export function DetailError({ error, onRetry, notFound }: { error?: unknown; onRetry?: () => void; notFound?: boolean }) {
  const status = (error as { status?: number; message?: string })?.message?.match(/\b(404|400)\b/);
  const missing = notFound || !!status;
  return (
    <div className={s.error} data-test="page-error">
      <h1 className={s.errorTitle}>{missing ? 'This page is not available' : 'Something went wrong'}</h1>
      <p className={s.errorText}>{missing ? "It may have been removed, or it isn't available in your region." : "We couldn't load this page. Check your connection and try again."}</p>
      {onRetry && !missing && (
        <button type="button" className={s.retry} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
