import { forwardRef, useImperativeHandle, useRef } from 'react';

/**
 * The six code boxes shared by email sign-in and password reset.
 *
 * `value` is an array of single characters; `onChange` receives the next array.
 * Typing advances, Backspace on an empty box steps back, and pasting a whole
 * code fills the rest — the three things people actually do with an OTP field.
 * The ref exposes focus(), so the page can jump here the moment a code is sent.
 */
const OtpInput = forwardRef(function OtpInput({ value, onChange, disabled }, ref) {
  const boxes = useRef([]);
  useImperativeHandle(ref, () => ({ focus: () => boxes.current[0]?.focus() }), []);

  const length = value.length;
  const setDigit = (i, digit) => onChange(value.map((d, j) => (j === i ? digit : d)));

  const onInput = (i, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 1) {
      const next = [...value];
      raw.slice(0, length - i).split('').forEach((ch, k) => { next[i + k] = ch; });
      onChange(next);
      boxes.current[Math.min(i + raw.length, length - 1)]?.focus();
      return;
    }
    setDigit(i, raw);
    if (raw && i < length - 1) boxes.current[i + 1]?.focus();
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      setDigit(i - 1, '');
      boxes.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < length - 1) boxes.current[i + 1]?.focus();
  };

  return (
    <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
      {value.map((digit, i) => (
        <input
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          ref={(el) => { boxes.current[i] = el; }}
          className="input text-center"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          value={digit}
          disabled={disabled}
          style={{ flex: '1 1 0', minWidth: 0, maxWidth: 52, padding: 0, fontSize: 'var(--fs-lg)', fontWeight: 700 }}
          onChange={(e) => onInput(i, e)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
});

export default OtpInput;
