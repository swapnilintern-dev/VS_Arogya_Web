import { forwardRef } from 'react';
import Icon from '../feedback/Icon';
import Field from './Field';
import cn from '../../utils/cn';

export const Input = forwardRef(function Input(
  { label, required, hint, error, className, prefix, ...rest }, ref,
) {
  const control = (
    <input ref={ref} className={cn('input', className)} aria-invalid={!!error} {...rest} />
  );
  if (!label && !hint && !error) return control;
  return <Field label={label} required={required} hint={hint} error={error} htmlFor={rest.id}>{control}</Field>;
});

export const Textarea = forwardRef(function Textarea(
  { label, required, hint, error, className, ...rest }, ref,
) {
  const control = (
    <textarea ref={ref} className={cn('textarea', className)} aria-invalid={!!error} {...rest} />
  );
  if (!label && !hint && !error) return control;
  return <Field label={label} required={required} hint={hint} error={error} htmlFor={rest.id}>{control}</Field>;
});

export const Select = forwardRef(function Select(
  { label, required, hint, error, options = [], placeholder, className, children, ...rest }, ref,
) {
  const control = (
    <select ref={ref} className={cn('select', className)} aria-invalid={!!error} {...rest}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const value = typeof o === 'string' ? o : o.value;
        const text = typeof o === 'string' ? o : o.label;
        return <option key={value} value={value}>{text}</option>;
      })}
      {children}
    </select>
  );
  if (!label && !hint && !error) return control;
  return <Field label={label} required={required} hint={hint} error={error} htmlFor={rest.id}>{control}</Field>;
});

/** The site-wide search box — icon inside, debounced by the caller. */
export function SearchInput({ value, onChange, placeholder = 'Search…', className, ...rest }) {
  return (
    <div className={cn('search', className)}>
      <Icon name="search" size={15} />
      <input
        className="input"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  );
}

export default Input;
