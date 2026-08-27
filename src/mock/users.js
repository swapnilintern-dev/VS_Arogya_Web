// =============================================================================
// Mock accounts — server/model/userModel.js (Vendor collection) and
// outletregistersModel.js (Outlet collection).
//
// One demo login per role. The Flutter sign-in cascade is reproduced in
// authService: /login is tried first, then agent-login, then outlet-login.
// =============================================================================

import { oid, int, monthsAgo, daysAgo, monthsAhead } from './seed';
import { ROLES } from '../constants/roles';

const CITIES = [
  ['Pune', 'Maharashtra', '411001'],
  ['Nashik', 'Maharashtra', '422001'],
  ['Nagpur', 'Maharashtra', '440001'],
  ['Thane', 'Maharashtra', '400601'],
  ['Kolhapur', 'Maharashtra', '416001'],
  ['Aurangabad', 'Maharashtra', '431001'],
  ['Solapur', 'Maharashtra', '413001'],
  ['Satara', 'Maharashtra', '415001'],
];

const STORE_NAMES = [
  'Apollo Pharmacy', 'Wellness Medico', 'Sanjeevani Chemists', 'City Care Pharmacy',
  'Shree Medical Stores', 'LifeLine Drug House', 'Ganesh Medicals', 'Aarogyam Pharmacy',
  'MedPlus Retail', 'Nakoda Medical', 'Sai Krupa Chemists', 'Vitality Pharma',
  'Deep Medical Hall', 'Om Sai Pharmacy', 'Yash Medico', 'Nirmal Drug Store',
  'Rugna Seva Kendra', 'Prime Health Chemists', 'Sanket Medicals', 'Sharda Pharmacy',
];

const PERSONS = [
  'Rohit Kulkarni', 'Sneha Deshmukh', 'Amit Pawar', 'Priya Joshi', 'Nikhil Shinde',
  'Manisha Patil', 'Sagar More', 'Kavita Jadhav', 'Vikram Sawant', 'Anjali Bhosale',
  'Rahul Gaikwad', 'Pooja Chavan', 'Sandeep Wagh', 'Neha Kadam', 'Ganesh Salunkhe',
  'Aarti Thakur', 'Prashant Naik', 'Shweta Rane', 'Mahesh Bhagat', 'Trupti Lokhande',
];

/** The demo staff/vendor accounts the dev role switcher signs in as. */
export const DEMO_ACCOUNTS = [
  {
    _id: oid('u', 1),
    role: ROLES.ADMIN,
    store_name: 'VS Arogya Control',
    contact_person_name: 'Aditya Ranade',
    mobile_no: '9800000001',
    email: 'admin@vsarogya.in',
    city: 'Pune', state: 'Maharashtra', pin_code: '411001',
    approvalStatus: 'Approved',
  },
  {
    _id: oid('u', 2),
    role: ROLES.MARKETING,
    store_name: 'VS Arogya Marketing',
    contact_person_name: 'Meera Kulkarni',
    mobile_no: '9800000002',
    email: 'marketing@vsarogya.in',
    city: 'Pune', state: 'Maharashtra', pin_code: '411001',
    approvalStatus: 'Approved',
  },
  {
    _id: oid('u', 3),
    role: ROLES.VENDOR,
    vendor_type: 'Shop / Pharmacy',
    shop_type: 'Retail Pharmacy',
    store_name: 'Apollo Pharmacy',
    contact_person_name: 'Rohit Kulkarni',
    mobile_no: '9800000003',
    email: 'rohit@apollopharm.in',
    full_address: '12 MG Road, Camp',
    city: 'Pune', state: 'Maharashtra', pin_code: '411001',
    gst_status: 'yes', gst_no: '27AABCU9603R1ZM',
    drug_lic_no: 'MH-PN-20B-4417',
    drug_lic_ex_date: monthsAhead(19),
    approvalStatus: 'Approved',
    registrationSource: 'admin',
    notificationsEnabled: true,
  },
  {
    _id: oid('u', 4),
    role: ROLES.DELIVERY,
    contact_person_name: 'Sagar More',
    store_name: 'Sagar More',
    mobile_no: '9800000004',
    email: 'sagar.more@vsarogya.in',
    city: 'Pune', state: 'Maharashtra', pin_code: '411014',
    approvalStatus: 'Approved',
  },
  {
    _id: oid('u', 5),
    role: ROLES.AGENT,
    contact_person_name: 'Prashant Naik',
    store_name: 'Prashant Naik',
    mobile_no: '9800000005',
    email: 'prashant.naik@vsarogya.in',
    city: 'Nashik', state: 'Maharashtra', pin_code: '422001',
    approvalStatus: 'Approved',
  },
];

/** The outlet demo account lives in the Outlet collection, not Vendor. */
export const DEMO_OUTLET = {
  _id: oid('o', 1),
  outletName: 'VS Arogya Outlet — Camp',
  ownerName: 'Sunil Deshpande',
  mobileNo: '9800000006',
  email: 'camp.outlet@vsarogya.in',
  address: 'Shop 4, East Street, Camp',
  city: 'Pune', state: 'Maharashtra', pincode: '411001',
  gstNumber: '27AACCV1234K1Z9',
  status: 'Active',
  role: ROLES.OUTLET,
  createdAt: monthsAgo(14),
};

/** Every demo account shares this password. Dev-only. */
export const DEMO_PASSWORD = 'demo1234';

// -----------------------------------------------------------------------------
// The wider directory: buyers, delivery partners and area agents.
// -----------------------------------------------------------------------------

function buildVendor(i) {
  const [city, state, pin] = CITIES[i % CITIES.length];
  const status = i % 9 === 0 ? 'Pending' : i % 17 === 0 ? 'Rejected' : 'Approved';
  return {
    _id: oid('v', i + 10),
    role: ROLES.VENDOR,
    vendor_type: i % 5 === 0 ? 'Hospital / Clinic' : 'Shop / Pharmacy',
    shop_type: ['Retail Pharmacy', 'Wholesale Pharmacy', 'Hospital Pharmacy', 'Ayurvedic / Herbal Store'][i % 4],
    store_name: STORE_NAMES[i % STORE_NAMES.length],
    contact_person_name: PERSONS[i % PERSONS.length],
    mobile_no: `98${String(21000000 + i * 137).slice(0, 8)}`,
    email: `${STORE_NAMES[i % STORE_NAMES.length].toLowerCase().replace(/[^a-z]/g, '')}${i}@mail.in`,
    full_address: `${int(2, 180)} ${['MG Road', 'Station Road', 'Main Bazaar', 'College Road', 'Market Yard'][i % 5]}`,
    city, state, pin_code: pin,
    gst_status: i % 6 === 0 ? 'no' : 'yes',
    gst_no: i % 6 === 0 ? '' : `27AAB${String(1000 + i)}R1Z${i % 10}`,
    drug_lic_no: `MH-${city.slice(0, 2).toUpperCase()}-20B-${4000 + i}`,
    drug_lic_ex_date: monthsAhead(int(-2, 30)),
    approvalStatus: status,
    registrationSource: i % 7 === 0 ? 'outlet' : 'admin',
    notificationsEnabled: i % 11 !== 0,
    store_pic: { url: '', publicId: '' },
    drug_lic_copy: { url: '', publicId: '', fileName: `drug-license-${i}.pdf` },
    gst_pdf: i % 6 === 0 ? undefined : { url: '', publicId: '', fileName: `gst-cert-${i}.pdf` },
    addresses: [],
    createdAt: daysAgo(int(0, 420)),
  };
}

function buildDeliveryAgent(i) {
  const [city, state, pin] = CITIES[i % CITIES.length];
  return {
    _id: oid('d', i + 1),
    role: ROLES.DELIVERY,
    contact_person_name: PERSONS[(i + 4) % PERSONS.length],
    store_name: PERSONS[(i + 4) % PERSONS.length],
    mobile_no: `97${String(31000000 + i * 211).slice(0, 8)}`,
    email: `rider${i + 1}@vsarogya.in`,
    city, state, pin_code: pin,
    approvalStatus: 'Approved',
    createdAt: daysAgo(int(20, 400)),
  };
}

function buildAreaAgent(i) {
  const [city, state, pin] = CITIES[(i + 2) % CITIES.length];
  return {
    _id: oid('a', i + 1),
    role: ROLES.AGENT,
    contact_person_name: PERSONS[(i + 9) % PERSONS.length],
    store_name: PERSONS[(i + 9) % PERSONS.length],
    mobile_no: `96${String(41000000 + i * 317).slice(0, 8)}`,
    email: `agent${i + 1}@vsarogya.in`,
    city, state, pin_code: pin,
    approvalStatus: 'Approved',
    createdAt: daysAgo(int(30, 300)),
  };
}

export const VENDORS = Array.from({ length: 26 }, (_, i) => buildVendor(i));
export const DELIVERY_AGENTS = Array.from({ length: 7 }, (_, i) => buildDeliveryAgent(i));
export const AREA_AGENTS = Array.from({ length: 5 }, (_, i) => buildAreaAgent(i));

/**
 * GET /all-vendors returns EVERY account in the Vendor collection — buyers and
 * staff alike. Consumers filter by `role`, exactly as the Flutter services do.
 */
export const ALL_VENDOR_COLLECTION = [
  ...DEMO_ACCOUNTS,
  ...VENDORS,
  ...DELIVERY_AGENTS,
  ...AREA_AGENTS,
];

export const findAccountByMobile = (mobile) =>
  ALL_VENDOR_COLLECTION.find((u) => u.mobile_no === String(mobile).trim());
