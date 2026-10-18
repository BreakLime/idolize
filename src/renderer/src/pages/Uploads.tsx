// TIDAL's Upload page. Uploading is out of scope in Idolize, so this is the read-only empty state in TIDAL's layout.
import { IdolLogo } from '@/components/Icon';
import s from './Uploads.module.css';

export default function Uploads() {
  return (
    <div className={s.page} data-test="your-uploads-page">
      <div className={s.titleRow}>
        <h1 className={s.title}>Upload</h1>
      </div>
      <div className={s.body}>
        <div className={s.empty} data-test="no-uploads">
          <div className={s.card} data-test="dnd-uploader">
            <div className={s.art} aria-hidden>
              <IdolLogo size={32} />
            </div>
            <div className={s.text}>
              <div className={s.copy}>
                <span className={s.heading}>Uploading isn't part of Idolize</span>
                <span className={s.muted}>Use TIDAL's own apps to upload tracks.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
