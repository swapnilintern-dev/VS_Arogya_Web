// =============================================================================
// Bulk medicine import — the sheet contract of POST /vsArogya/bulk-upload
// (controller/bulkUploadController.js).
//
// THE SERVER PARSES THE SHEET, not the browser. The page uploads the file as-is
// and the server answers with per-row results. Everything here exists so the
// person filling the sheet gets the same verdict BEFORE the upload: the column
// list is transcribed from the controller's `row["..."]` lookups, so a preview
// that passes is a row the server will accept.
//
// Column names are matched by the server EXACTLY as written below (including
// the "Wholseller_%" spelling), which is why the template is generated from
// this list rather than typed by hand.
// =============================================================================

import * as XLSX from 'xlsx';
import { MEDICINE_CATEGORIES } from '../constants/catalog';

/** `type` drives preview validation only — the server coerces every cell itself. */
export const COLUMNS = [
  { key: 'Title', required: true, example: 'Amoxicillin 500 mg Capsules', hint: 'text' },
  { key: 'Brand', example: 'MOX 500', hint: 'text' },
  { key: 'Code', example: 'VSA-CAP-0045', hint: 'text' },
  { key: 'Category', required: true, example: 'Medicine', hint: MEDICINE_CATEGORIES.join(' / ') },
  { key: 'Manufacturer', example: 'Sun Pharmaceutical', hint: 'text' },
  { key: 'Marketed By', example: 'Sun Pharmaceutical', hint: 'text' },
  { key: 'Description', example: 'Broad-spectrum antibiotic', hint: 'text' },
  { key: 'Pack Info', example: 'Strip of 10 capsules', hint: 'text' },
  { key: 'Pack Of', type: 'number', example: 10, hint: 'number' },
  { key: 'Quantity', example: '1', hint: 'text' },
  { key: 'MRP', type: 'number', example: 198, hint: 'number' },
  { key: 'Selling Price', required: true, type: 'number', example: 188.1, hint: 'number' },
  { key: 'Discount Percent', type: 'number', example: 5, hint: '% off MRP' },
  { key: 'DR_DIS_%', type: 'number', example: 8, hint: 'doctor / clinic rate' },
  { key: 'Wholseller_%', type: 'number', example: 12, hint: 'wholesale rate' },
  { key: 'GST Percent', type: 'number', example: 12, hint: 'number' },
  { key: 'HSN Code', example: '30049099', hint: 'text' },
  { key: 'Batch No', required: true, example: 'AMX25B097', hint: 'unique per product' },
  { key: 'Expiry Date', type: 'date', example: '2027-12-31', hint: 'YYYY-MM-DD' },
  { key: 'Stock', type: 'number', example: 500, hint: 'opening units' },
  { key: 'Low Threshold', type: 'number', example: 20, hint: 'number' },
  { key: 'Cold Stored', type: 'yesno', example: 'no', hint: 'yes / no' },
  { key: 'Prescription Required', type: 'yesno', example: 'yes', hint: 'yes / no' },
  { key: 'Active', type: 'yesno', example: 'yes', hint: 'yes / no' },
  { key: 'Image URL', example: 'https://example.com/amoxicillin.jpg', hint: 'comma-separated links' },
  { key: 'Rating', type: 'number', example: 4.5, hint: 'number' },
  { key: 'Review Count', type: 'number', example: 0, hint: 'number' },
];

export const REQUIRED_COLUMNS = COLUMNS.filter((c) => c.required).map((c) => c.key);

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9%]+/g, '');

/**
 * The server reads `row["Title"]` and friends verbatim, so a header that only
 * differs in case or spacing would be silently dropped. This reports those as
 * problems rather than letting the upload fail row by row.
 */
export function checkHeaders(headers) {
  const present = headers.map((h) => String(h ?? '').trim()).filter(Boolean);
  const exact = new Set(present);
  const known = new Map(COLUMNS.map((c) => [norm(c.key), c.key]));

  const missing = REQUIRED_COLUMNS.filter((k) => !exact.has(k));
  const misspelled = [];
  const unknown = [];
  present.forEach((h) => {
    if (exact.has(h) && known.has(norm(h)) && known.get(norm(h)) === h) return;
    const match = known.get(norm(h));
    if (match && match !== h) misspelled.push({ found: h, expected: match });
    else if (!match) unknown.push(h);
  });
  return { missing, misspelled, unknown };
}

// --- Cell parsing (preview only — the server does its own) -------------------

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * Mirrors what the server will make of the cell. It does `new Date(value)`,
 * which reads an ambiguous "01-02-2027" as MM-DD — so a DD-MM-YYYY value is
 * flagged in the preview and the template asks for YYYY-MM-DD.
 */
export function parseSheetDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : iso(new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())));
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    return iso(new Date(EXCEL_EPOCH_UTC + Math.round(value) * 86400000));
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : iso(new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())));
}

/** True when the text could be read as either DD-MM or MM-DD. */
const isAmbiguousDate = (value) => {
  if (typeof value !== 'string') return false;
  const m = value.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  return !!m && Number(m[1]) <= 12 && Number(m[2]) <= 12;
};

const toNumber = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(String(v).replace(/[₹,%\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

export const splitUrls = (value) => String(value ?? '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

/** Validates one row the way the controller will. */
export function checkRow(row) {
  const errors = [];
  const warnings = [];

  const title = String(row.Title ?? '').trim();
  const category = String(row.Category ?? '').trim();
  const batchNo = String(row['Batch No'] ?? '').trim();
  const price = toNumber(row['Selling Price']);

  if (!title) errors.push('Title is required');
  if (!category) errors.push('Category is required');
  if (!batchNo) errors.push('Batch No is required');
  if (row['Selling Price'] === '' || row['Selling Price'] === undefined || Number.isNaN(price)) {
    errors.push('Invalid Selling Price');
  }

  ['MRP', 'Pack Of', 'GST Percent', 'Discount Percent', 'DR_DIS_%', 'Wholseller_%', 'Stock', 'Low Threshold', 'Rating', 'Review Count']
    .forEach((k) => { if (Number.isNaN(toNumber(row[k]))) errors.push(`${k} must be a number`); });

  const mrp = toNumber(row.MRP);
  if (mrp !== undefined && price !== undefined && !Number.isNaN(price) && price > mrp && mrp > 0) {
    warnings.push('Selling Price is above MRP');
  }

  if (row['Expiry Date']) {
    const d = parseSheetDate(row['Expiry Date']);
    if (!d) warnings.push('Expiry Date could not be read — it will be saved empty');
    else if (isAmbiguousDate(row['Expiry Date'])) warnings.push(`Ambiguous date — the server will read it as ${d}. Use YYYY-MM-DD.`);
    else if (d < new Date().toISOString().slice(0, 10)) warnings.push('Expiry Date is in the past');
  } else {
    warnings.push('No expiry date');
  }

  const urls = splitUrls(row['Image URL']);
  if (!urls.length) warnings.push('No image');
  else if (urls.some((u) => !/^https?:\/\//i.test(u))) errors.push('Image URL must start with http:// or https://');

  if (category && !MEDICINE_CATEGORIES.some((c) => norm(c) === norm(category))) {
    warnings.push(`"${category}" is not one of the standard categories`);
  }
  if (toNumber(row['DR_DIS_%']) > 100 || toNumber(row['Wholseller_%']) > 100) {
    errors.push('A discount percentage cannot exceed 100');
  }

  return {
    title, category, batchNo, price,
    stock: toNumber(row.Stock) || 0,
    expiry: row['Expiry Date'] ? parseSheetDate(row['Expiry Date']) : null,
    images: urls.length,
    doctorPercent: toNumber(row['DR_DIS_%']) || 0,
    wholesalePercent: toNumber(row['Wholseller_%']) || 0,
    errors,
    warnings,
  };
}

// --- File I/O ----------------------------------------------------------------

/**
 * Reads the first sheet the same way the server does
 * (`XLSX.utils.sheet_to_json` with `defval: ""`), so the preview sees exactly
 * the rows the controller will loop over.
 */
export async function previewWorkbook(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error('The file has no sheets.');

  const headers = (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })[0] || []).map((h) => String(h ?? ''));
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) throw new Error('The sheet has a header but no medicines.');

  const seen = new Set();
  const checked = rows.map((row, i) => {
    const result = checkRow(row);
    // The controller rejects a batch number repeated within the sheet.
    if (result.batchNo && seen.has(result.batchNo)) result.errors.push('Duplicate Batch No in this sheet');
    else if (result.batchNo) seen.add(result.batchNo);
    return { excelRow: i + 2, ...result };
  });

  return { sheetName, headers, ...checkHeaders(headers), rows: checked };
}

/** Builds and downloads the .xlsx template with one example row. */
export function downloadTemplate() {
  const header = COLUMNS.map((c) => c.key);
  const example = COLUMNS.map((c) => c.example ?? '');
  const notes = [
    ['VS Arogya — bulk medicine upload'],
    [''],
    ['Keep the header row EXACTLY as it is — the server matches column names letter for letter.'],
    [`Required columns: ${REQUIRED_COLUMNS.join(', ')}.`],
    [''],
    ['Batch No must be unique — a batch number that already exists in the catalogue is skipped.'],
    ['Expiry Date: write it as YYYY-MM-DD (2027-12-31). A 01-02-2027 style date is read month-first.'],
    ['Image URL: one or more public http(s) links separated by commas. The first is the main image.'],
    [''],
    ['Rate cards — one medicine can be priced three ways:'],
    ['  Selling Price  → what an ordinary retail pharmacy pays.'],
    ['  DR_DIS_%       → % off the selling price for a Hospital / Clinic buyer.'],
    ['  Wholseller_%   → % off the selling price for a wholesale / distributor buyer.'],
    ['  Leave a percentage blank or 0 and that buyer simply pays the selling price.'],
    [''],
    ['Cold Stored / Prescription Required / Active: write yes or no.'],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, example]);
  ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(14, c.key.length + 4) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Medicines');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(notes), 'Instructions');
  XLSX.writeFile(wb, 'vs-arogya-medicine-upload-template.xlsx');
}

/** Downloads the rows the server (or the preview) rejected, with the reason. */
export function downloadFailedRows(failed) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Row', 'Title', 'Batch No', 'Reason'],
    ...failed.map((r) => [r.row ?? '', r.title ?? '', r.batchNo ?? '', r.reason ?? '']),
  ]);
  ws['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 18 }, { wch: 46 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Rejected rows');
  XLSX.writeFile(wb, 'vs-arogya-rejected-rows.xlsx');
}
