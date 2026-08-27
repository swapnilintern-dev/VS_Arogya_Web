import cn from '../../utils/cn';

export function Card({ children, pad = false, flat = false, className, ...rest }) {
  return (
    <section className={cn('card', pad && 'card--pad', flat && 'card--flat', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHead({ title, sub, actions, className, ...rest }) {
  return (
    <header className={cn('card__head', className)} {...rest}>
      <div className="grow">
        {title && <h3 className="card__title">{title}</h3>}
        {sub && <p className="card__sub">{sub}</p>}
      </div>
      {actions && <div className="row gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ children, tight = false, className, ...rest }) {
  return (
    <div className={cn('card__body', tight && 'card__body--tight', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFoot({ children, className, ...rest }) {
  return <footer className={cn('card__foot', className)} {...rest}>{children}</footer>;
}

export default Card;
