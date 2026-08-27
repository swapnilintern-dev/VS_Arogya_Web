import { Link } from 'react-router-dom';
import Icon from '../feedback/Icon';

/** Title + optional breadcrumb trail + right-aligned actions. */
export default function PageHeader({ title, sub, actions, back, crumbs }) {
  return (
    <div className="page__head">
      <div className="grow">
        {crumbs?.length > 0 && (
          <nav className="topbar__crumbs" style={{ marginBottom: 6 }}>
            {crumbs.map((c, i) => (
              <span key={`${i}-${c.label}`} className="row gap-1">
                {i > 0 && <Icon name="chevronRight" size={11} />}
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <div className="row gap-3">
          {back && (
            <Link to={back} className="btn btn--secondary btn--icon btn--sm" aria-label="Back">
              <Icon name="arrowLeft" size={15} />
            </Link>
          )}
          <h1 className="page__title">{title}</h1>
        </div>
        {sub && <p className="page__sub">{sub}</p>}
      </div>
      {actions && <div className="page__actions">{actions}</div>}
    </div>
  );
}
