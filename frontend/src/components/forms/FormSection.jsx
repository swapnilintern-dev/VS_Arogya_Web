import Icon from '../feedback/Icon';
import { Card, CardBody } from '../common/Card';

/** A titled card section — the building block of every long form. */
export default function FormSection({ icon, title, sub, children, actions }) {
  return (
    <Card>
      <div className="card__head">
        <div className="row gap-3 grow">
          {icon && <span className="stat__icon"><Icon name={icon} size={15} /></span>}
          <div>
            <h3 className="card__title">{title}</h3>
            {sub && <p className="card__sub">{sub}</p>}
          </div>
        </div>
        {actions}
      </div>
      <CardBody><div className="form-section">{children}</div></CardBody>
    </Card>
  );
}
