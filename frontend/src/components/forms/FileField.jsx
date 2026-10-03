import { useRef, useState } from 'react';
import Icon from '../feedback/Icon';
import Field from './Field';
import Button from '../common/Button';

/**
 * File picker for the KYC documents and creative uploads. Shows the chosen
 * file's name and size; the actual upload is multipart in the service layer.
 */
export default function FileField({
  label, required, hint, error, accept, onChange, value, subtitle,
}) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(value || null);

  const pick = (f) => { setFile(f); onChange?.(f); };

  return (
    <Field label={label} required={required} hint={hint} error={error}>
      <div
        className="row gap-3"
        style={{
          padding: 'var(--sp-3)',
          border: `1px dashed ${error ? 'var(--danger)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--r-md)',
          background: 'var(--surface-alt)',
        }}
      >
        <span className="thumb"><Icon name={file ? 'file' : 'download'} size={16} /></span>
        <div className="grow" style={{ minWidth: 0 }}>
          <p className="truncate" style={{ fontWeight: 600 }}>{file ? file.name : (subtitle || 'No file chosen')}</p>
          <p className="field__hint">
            {file ? `${(file.size / 1024).toFixed(0)} KB` : accept?.replace(/,/g, ', ') || 'PDF, JPG or PNG'}
          </p>
        </div>
        {file
          ? <Button size="sm" variant="ghost" icon="x" onClick={() => pick(null)} aria-label="Remove file" />
          : <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>Choose</Button>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => pick(e.target.files?.[0] || null)}
        />
      </div>
    </Field>
  );
}
