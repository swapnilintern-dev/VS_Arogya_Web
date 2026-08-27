/** Tiny className joiner — falsy values are dropped. */
export const cn = (...parts) => parts.filter(Boolean).join(' ');
export default cn;
