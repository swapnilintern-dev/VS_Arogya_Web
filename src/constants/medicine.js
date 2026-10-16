// =============================================================================
// Medicine information — presentation helpers for the product page.
//
// The product record from GET /all-products is the ONLY source of medicine
// content (server: model/productModel.js, utils/medicineInfo.js); the Flutter
// app reads the same record. Nothing here supplies medical facts — these
// helpers only clean up what the record already holds.
// =============================================================================

/** General fallback shown under every medicine. Product-specific warnings
 *  (precautions) are shown separately and are never replaced by this. */
export const MEDICAL_DISCLAIMER =
  'The information provided on this page is for general informational purposes and is not a substitute for '
  + 'professional medical advice, diagnosis, or treatment. Always follow the advice of a qualified healthcare '
  + 'professional and the approved product labeling. Do not start, stop, or change a medicine without consulting '
  + 'an appropriate healthcare professional. Verify the product name, strength, formulation, packaging, and '
  + 'prescription requirements before use or dispensing.';

export const NOT_AVAILABLE = 'Information not available.';

/** A display string, or '' for null / undefined / "null" / "NaN" and blanks. */
export function clean(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return /^(null|undefined|nan)$/i.test(text) ? '' : text;
}

/** Side effects arrive as an array (or, on old records, a delimited string). */
export function listOf(value) {
  const items = Array.isArray(value) ? value : clean(value).split(/\r?\n|;|\|/);
  return items.map(clean).filter(Boolean);
}

/**
 * Imported descriptions end with a block that repeats the structured fields:
 *   "<intro>\n\nComposition: …\nUses:\n- a\n- b\nStorage: …"
 * Returns the intro alone (so it is not shown twice) and the "Uses" bullet
 * list from that block, which keeps the item boundaries the flattened `uses`
 * field has lost. Both come from the same product record.
 */
export function splitDescription(description) {
  const text = clean(description);
  const marker = text.search(/\n\s*\n\s*Composition\s*:/i);
  if (marker < 0) return { intro: text, usesList: [] };

  const tail = text.slice(marker);
  const usesBlock = tail.match(/Uses\s*:\s*\n((?:[ \t]*[-•][^\n]*\n?)+)/i);
  const usesList = usesBlock
    ? usesBlock[1].split('\n').map((l) => clean(l.replace(/^\s*[-•]\s*/, ''))).filter(Boolean)
    : [];
  return { intro: text.slice(0, marker).trim(), usesList };
}
