// =============================================================================
// Mock catalogue — field names mirror server/model/productModel.js EXACTLY so
// swapping in GET /vsArogya/all-products needs no mapping change.
// =============================================================================

import { oid, int, money, chance, monthsAhead, monthsAgo, daysAgo } from './seed';
import { MEDICINE_CATEGORIES } from '../constants/catalog';

const SPECS = [
  ['Amoxicillin 500mg', 'Cipla', 'Capsule', 'Strip of 10 capsules', 'Medicine', false],
  ['Paracetamol 650mg', 'Sun Pharma', 'Tablet', 'Strip of 15 tablets', 'Medicine', false],
  ['Azithromycin 500mg', 'Alkem', 'Tablet', 'Strip of 5 tablets', 'Medicine', true],
  ['Pantoprazole 40mg', 'Zydus', 'Tablet', 'Strip of 15 tablets', 'Medicine', false],
  ['Metformin 500mg SR', 'USV', 'Tablet', 'Strip of 20 tablets', 'Medicine', true],
  ['Atorvastatin 10mg', 'Torrent', 'Tablet', 'Strip of 15 tablets', 'Medicine', true],
  ['Cetirizine 10mg', 'Dr. Reddy’s', 'Tablet', 'Strip of 10 tablets', 'Medicine', false],
  ['Amlodipine 5mg', 'Lupin', 'Tablet', 'Strip of 15 tablets', 'Medicine', true],
  ['Montelukast 10mg', 'Cipla', 'Tablet', 'Strip of 10 tablets', 'Medicine', true],
  ['Ondansetron 4mg', 'Emcure', 'Tablet', 'Strip of 10 tablets', 'Medicine', false],
  ['Vitamin D3 60K', 'Mankind', 'Sachet', 'Box of 4 sachets', 'Medicine', false],
  ['Iron + Folic Acid', 'Abbott', 'Tablet', 'Strip of 30 tablets', 'Medicine', false],
  ['ORS Powder', 'FDC', 'Powder', 'Box of 10 sachets', 'Medicine', false],
  ['Insulin Glargine 100IU', 'Biocon', 'Injection', 'Pen of 3ml', 'Lifesaving Injections', true],
  ['Adrenaline 1mg/ml', 'Neon Labs', 'Injection', 'Ampoule pack of 10', 'Lifesaving Injections', true],
  ['Heparin 5000IU', 'Gland Pharma', 'Injection', 'Vial of 5ml', 'Lifesaving Injections', true],
  ['Noradrenaline 2mg', 'Samarth', 'Injection', 'Ampoule pack of 5', 'Lifesaving Injections', true],
  ['Atropine Sulphate 0.6mg', 'Neon Labs', 'Injection', 'Ampoule pack of 10', 'Lifesaving Injections', true],
  ['Dopamine 200mg', 'Claris', 'Injection', 'Vial of 5ml', 'Lifesaving Injections', true],
  ['Hydrocortisone 100mg', 'Pfizer', 'Injection', 'Vial pack of 5', 'Lifesaving Injections', true],
  ['Tetanus Toxoid', 'Serum Institute', 'Vaccine', 'Vial of 0.5ml', 'Vaccines', true],
  ['Hepatitis B Vaccine', 'Serum Institute', 'Vaccine', 'Vial of 1ml', 'Vaccines', true],
  ['Rabies Vaccine (PCEC)', 'Bharat Biotech', 'Vaccine', 'Vial pack of 1', 'Vaccines', true],
  ['Influenza Vaccine', 'Sanofi', 'Vaccine', 'Prefilled syringe', 'Vaccines', true],
  ['Typhoid Conjugate', 'Bharat Biotech', 'Vaccine', 'Vial of 0.5ml', 'Vaccines', true],
  ['MMR Vaccine', 'Serum Institute', 'Vaccine', 'Vial of 0.5ml', 'Vaccines', true],
  ['Pneumococcal PCV13', 'Pfizer', 'Vaccine', 'Prefilled syringe', 'Vaccines', true],
  ['Diclofenac Gel 30g', 'Novartis', 'Gel', 'Tube of 30g', 'Medicine', false],
  ['Povidone Iodine 100ml', 'Win-Medicare', 'Solution', 'Bottle of 100ml', 'Medicine', false],
  ['Surgical Gloves (M)', 'Romsons', 'Consumable', 'Box of 100 pairs', 'Medicine', false],
];

const MARKETERS = ['VS Arogya Distribution', 'MediCore Healthcare', 'Arogya Life Sciences'];

/** One product document, shaped like the Mongoose model. */
function buildProduct(spec, i) {
  const [title, brand, form, packInfo, category, coldStored] = spec;
  const mrp = money(38, 1650, 0.5);
  const discountPercent = [0, 5, 8, 10, 12, 15][i % 6];
  const price = Math.round(mrp * (1 - discountPercent / 100) * 100) / 100;
  const stock = i % 9 === 0 ? 0 : i % 5 === 0 ? int(2, 9) : int(40, 950);

  return {
    _id: oid('p', i + 1),
    title,
    description:
      `${title} — ${form.toLowerCase()} supplied in a ${packInfo.toLowerCase()}. ` +
      `Manufactured by ${brand} and marketed by ${MARKETERS[i % MARKETERS.length]}. ` +
      (coldStored
        ? 'Cold-chain product: store between 2°C and 8°C, do not freeze.'
        : 'Store below 25°C in a dry place, away from direct sunlight.'),
    price,
    category,
    cold_stored: coldStored ? 'yes' : 'no',
    batch_no: `B${String(2400 + i)}`,
    exp_date: monthsAhead(i % 11 === 0 ? 1.5 : i % 7 === 0 ? 4 : int(9, 34)),
    mrp,
    brand,
    code: `VSA-${String(1000 + i)}`,
    manufacturer: brand,
    marketedBy: MARKETERS[i % MARKETERS.length],
    stock,
    active: i % 13 !== 0,
    packOf: Number((packInfo.match(/\d+/) || [1])[0]),
    hsnCode: category === 'Vaccines' ? '3002' : '3004',
    gstPercent: category === 'Medicine' ? 12 : 5,
    discountPercent,
    lowThreshold: 10,
    prescriptionRequired: category !== 'Medicine' || i % 3 === 0,
    rating: Math.round((3.9 + (i % 11) / 10) * 10) / 10,
    reviewCount: int(4, 340),
    badge: i % 8 === 0 ? 'BEST SELLER' : i % 12 === 0 ? 'NEW' : undefined,
    packInfo,
    image: [],
    video: undefined,
    quantity: '1',
    createdAt: monthsAgo(int(1, 20)),
    updatedAt: daysAgo(int(0, 40)),
    // The backend's virtual — recomputed on read, so mirrored here.
    get isExpiringSoon() {
      if (!this.exp_date) return false;
      const days = Math.ceil((new Date(this.exp_date) - Date.now()) / 86400000);
      return days <= 90;
    },
  };
}

export const PRODUCTS = SPECS.map(buildProduct);

/** Category counts, used by the storefront chips. */
export const CATEGORY_COUNTS = MEDICINE_CATEGORIES.reduce((acc, c) => {
  acc[c] = PRODUCTS.filter((p) => p.category === c).length;
  return acc;
}, {});

// -----------------------------------------------------------------------------
// BATCHES — server/model/productBatchModel.js. product.stock is the SUM of
// available_quantity across a product's lots, so the totals below are built to
// match each product's `stock` exactly.
// -----------------------------------------------------------------------------

const SUPPLIERS = [
  'Meditrust Distributors',
  'Anand Pharma Agency',
  'Krishna Medico Supplies',
  'Sanjeevani Traders',
  'Vardhman Healthcare',
];

function buildBatchesFor(product, index) {
  const lots = product.stock === 0 ? 1 : product.stock < 20 ? 1 : int(2, 4);
  const out = [];
  let left = product.stock;

  for (let i = 0; i < lots; i += 1) {
    const last = i === lots - 1;
    const available = last ? Math.max(0, left) : Math.max(0, Math.floor(left / (lots - i)));
    left -= available;
    const purchase = available + (chance(0.65) ? int(10, 220) : 0);
    const purchasePrice = Math.round(product.price * 0.72 * 100) / 100;

    // The first lot is the FEFO front — it carries the product's mirrored expiry.
    const expiry = i === 0 ? product.exp_date : monthsAhead(int(10, 36));

    out.push({
      _id: oid(`b${index}`, i + 1),
      product_id: product._id,
      batch_number: i === 0 ? product.batch_no : `B${String(2400 + index)}-${i + 1}`,
      purchase_quantity: purchase,
      available_quantity: available,
      purchase_price: purchasePrice,
      selling_price: product.price,
      manufacturing_date: monthsAgo(int(3, 20)),
      expiry_date: expiry,
      supplier: SUPPLIERS[(index + i) % SUPPLIERS.length],
      createdAt: monthsAgo(int(1, 16)),
      updatedAt: daysAgo(int(0, 30)),
      get isExpiringSoon() {
        if (!this.expiry_date) return false;
        return Math.ceil((new Date(this.expiry_date) - Date.now()) / 86400000) <= 90;
      },
    });
  }
  return out;
}

/** Flat list of every lot in the catalogue. */
export const PRODUCT_BATCHES = PRODUCTS.flatMap(buildBatchesFor);

export const batchesOfProduct = (productId) =>
  PRODUCT_BATCHES.filter((b) => b.product_id === productId);
