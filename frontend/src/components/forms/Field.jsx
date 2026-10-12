import cn from '../../utils/cn';

/** Label + control + hint/error wrapper shared by every form on the site. */
export default function Field({ label, required, hint, error, children, className, htmlFor }) {
  return (
    <div className={cn('field', className)}>
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="field__req">*</span>}
        </label>
      )}
      {children}
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}
