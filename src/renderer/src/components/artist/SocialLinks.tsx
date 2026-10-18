// LINKS_LIST module ("Social"): icon + label links that open in the default browser.
import { SocialIcon, siteLabel } from '@/components/icons/artistSearch';
import s from './ArtistPage.module.css';

export function SocialLinks({ title, links }: { title: string; links: { siteName: string; url: string }[] }) {
  if (!links.length) return null;
  return (
    <div className={s.social}>
      <span className={s.socialTitle}>{title}</span>
      <div className={s.linksList}>
        {links.map((l) => (
          <div key={l.url} className={s.link}>
            <SocialIcon site={l.siteName} testId={`icon-${l.siteName}`} />
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className={s.linkText}
              data-test={`link-${l.siteName}`}
              onClick={(e) => {
                e.preventDefault();
                window.open(l.url, '_blank');
              }}
            >
              <span>{siteLabel(l.siteName)}</span>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
