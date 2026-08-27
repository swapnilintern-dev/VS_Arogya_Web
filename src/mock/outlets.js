// =============================================================================
// Mock outlets + outlet-held stock — outletregistersModel.js, outletStockModel.js
// and outletStockBatchModel.js.
//
// An outlet's lots keep the SAME batch identity (number + expiry) as the catalog
// lot they were assigned from, which is what lets staff trace a sale back.
// =============================================================================

import { oid, int, chance, monthsAgo, daysAgo } from './seed';
import { PRODUCTS, batchesOfProduct } from './products';
import { DEMO_OUTLET } from './users';

const OUTLET_SPECS = [
  ['VS Arogya Outlet — Camp', 'Sunil Deshpande', 'Pune', '411001'],
  ['VS Arogya Outlet — Kothrud', 'Rekha Phadke', 'Pune', '411038'],
  ['VS Arogya Outlet — Nashik Road', 'Vijay Sonawane', 'Nashik', '422101'],
  ['VS Arogya Outlet — Dharampeth', 'Alok Deshmukh', 'Nagpur', '440010'],
  ['VS Arogya Outlet — Thane West', 'Farida Shaikh', 'Thane', '400601'],
  ['VS Arogya Outlet — Kolhapur', 'Nitin Patil', 'Kolhapur', '416001'],
];

export const OUTLETS = OUTLET_SPECS.map(([outletName, ownerName, city, pincode], i) => (
  i === 0
    ? DEMO_OUTLET
    : {
      _id: oid('o', i + 1),
      outletName,
      ownerName,
      mobileNo: `95${String(51000000 + i * 421).slice(0, 8)}`,
      email: `outlet${i + 1}@vsarogya.in`,
      address: `Shop ${int(1, 40)}, ${['Main Road', 'Market Lane', 'Station Road'][i % 3]}`,
      city,
      state: 'Maharashtra',
      pincode,
      gstNumber: `27AACCV${String(1000 + i)}K1Z${i % 10}`,
      status: i === 5 ? 'Inactive' : 'Active',
      role: 'outlet',
      createdAt: monthsAgo(int(2, 20)),
    }
));

export const outletById = (id) => OUTLETS.find((o) => o._id === id);
export const outletsInPincode = (pincode) =>
  OUTLETS.filter((o) => !pincode || o.pincode === String(pincode).trim());

// -----------------------------------------------------------------------------
// The demo outlet's own stock — a subset of the catalogue, with its own lots.
// -----------------------------------------------------------------------------

const HELD = PRODUCTS.filter((_, i) => i % 2 === 0).slice(0, 14);

function buildOutletLots(product, index) {
  const catalogLots = batchesOfProduct(product._id);
  const count = Math.min(catalogLots.length, index % 4 === 0 ? 3 : 2);
  return Array.from({ length: count }, (_, i) => {
    const source = catalogLots[i] || catalogLots[0];
    // Deliberately include one expired and one emptied lot so the "all lots"
    // view has the states the app's Medicine Details screen renders.
    const expired = index === 3 && i === 1;
    const emptied = index === 6 && i === 1;
    return {
      _id: oid(`ob${index}`, i + 1),
      outlet: DEMO_OUTLET._id,
      product: product._id,
      batch_number: source.batch_number,
      available_quantity: emptied ? 0 : int(4, 90),
      purchase_price: source.purchase_price,
      selling_price: source.selling_price,
      manufacturing_date: source.manufacturing_date,
      expiry_date: expired ? monthsAgo(2) : source.expiry_date,
      supplier: source.supplier,
      createdAt: monthsAgo(int(1, 8)),
      updatedAt: daysAgo(int(0, 20)),
      get isExpiringSoon() {
        if (!this.expiry_date) return false;
        return Math.ceil((new Date(this.expiry_date) - Date.now()) / 86400000) <= 90;
      },
    };
  });
}

export const OUTLET_STOCK_BATCHES = HELD.flatMap(buildOutletLots);

/**
 * outletStock rows — `quantity` is the auto-synced mirror of the SUM over that
 * product's outlet lots, exactly as the server maintains it.
 */
export const OUTLET_STOCK = HELD.map((p) => {
  const lots = OUTLET_STOCK_BATCHES.filter((b) => b.product === p._id);
  return {
    _id: oid('os', HELD.indexOf(p) + 1),
    outlet: DEMO_OUTLET._id,
    product: { ...p },
    quantity: lots.reduce((s, b) => s + b.available_quantity, 0),
    batchCount: lots.length,
  };
});

export const outletLotsOf = (productId) =>
  OUTLET_STOCK_BATCHES.filter((b) => b.product === productId);

/** Sellable lots only, FEFO order — what the batch picker shows. */
export const sellableOutletLotsOf = (productId) =>
  outletLotsOf(productId)
    .filter((b) => b.available_quantity > 0)
    .filter((b) => !b.expiry_date || new Date(b.expiry_date) >= new Date())
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
