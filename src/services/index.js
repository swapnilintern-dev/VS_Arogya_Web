// Barrel for the service layer. Pages import named functions from here or from
// the individual modules; either way, no component ever touches fetch.
export * as authService from './authService';
export * as productService from './productService';
export * as orderService from './orderService';
export * as vendorService from './vendorService';
export * as outletService from './outletService';
export * as cartService from './cartService';
export * as couponService from './couponService';
export * as notificationService from './notificationService';
export * as deliveryService from './deliveryService';
export * as reportService from './reportService';
export * as supportService from './supportService';
export { ApiError, NotImplementedError, USE_MOCK } from './http';
