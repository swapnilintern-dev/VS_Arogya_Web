// =============================================================================
// The route tree.
//
// One segment per role, each behind a role guard. The Flutter app has no named
// routes at all (every screen is an imperative Navigator.push), so this URL
// scheme is a website-side design decision — see PROJECT_ANALYSIS.md §8 for the
// screen-by-screen mapping.
// =============================================================================

import { createBrowserRouter, Navigate } from 'react-router-dom';

import App from './App';
import ProtectedRoute from './ProtectedRoute';
import NotFound from './NotFound';

import AuthLayout from '../components/layout/AuthLayout';
import DashboardLayout from '../components/layout/DashboardLayout';
import StorefrontLayout from '../components/layout/StorefrontLayout';

import { ROLES } from '../constants/roles';

// --- Auth --------------------------------------------------------------------
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import RegisterSuccessPage from '../pages/auth/RegisterSuccessPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';

// --- Admin -------------------------------------------------------------------
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminVendors from '../pages/admin/AdminVendors';
import AdminVendorDetail from '../pages/admin/AdminVendorDetail';
import AdminOrders from '../pages/admin/AdminOrders';
import AdminOrderDetail from '../pages/admin/AdminOrderDetail';
import AdminProducts from '../pages/admin/AdminProducts';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminDelivery from '../pages/admin/AdminDelivery';
import AdminAnalytics from '../pages/admin/AdminAnalytics';
import AdminDisputes from '../pages/admin/AdminDisputes';
import AdminDeletionRequests from '../pages/admin/AdminDeletionRequests';
import AdminSettings from '../pages/admin/AdminSettings';

// --- Marketing ---------------------------------------------------------------
import MarketingDashboard from '../pages/marketing/MarketingDashboard';
import MarketingProducts from '../pages/marketing/MarketingProducts';
import MarketingProductEditor from '../pages/marketing/MarketingProductEditor';
import MarketingBulkUpload from '../pages/marketing/MarketingBulkUpload';
import MarketingBatches from '../pages/marketing/MarketingBatches';
import MarketingOrders from '../pages/marketing/MarketingOrders';
import MarketingOrderDetail from '../pages/marketing/MarketingOrderDetail';
import MarketingManualOrder from '../pages/marketing/MarketingManualOrder';
import MarketingOutlets from '../pages/marketing/MarketingOutlets';
import MarketingOutletRegister from '../pages/marketing/MarketingOutletRegister';
import MarketingAssignStock from '../pages/marketing/MarketingAssignStock';
import MarketingAgents from '../pages/marketing/MarketingAgents';
import MarketingAgentRegister from '../pages/marketing/MarketingAgentRegister';
import MarketingCoupons from '../pages/marketing/MarketingCoupons';
import MarketingBanners from '../pages/marketing/MarketingBanners';
import MarketingNotifications from '../pages/marketing/MarketingNotifications';
import MarketingNotificationComposer from '../pages/marketing/MarketingNotificationComposer';
import MarketingReports from '../pages/marketing/MarketingReports';

// --- Vendor ------------------------------------------------------------------
import VendorHome from '../pages/vendor/VendorHome';
import VendorProductDetail from '../pages/vendor/VendorProductDetail';
import VendorCart from '../pages/vendor/VendorCart';
import VendorCheckout from '../pages/vendor/VendorCheckout';
import VendorOrders from '../pages/vendor/VendorOrders';
import VendorOrderDetail from '../pages/vendor/VendorOrderDetail';
import VendorInvoice from '../pages/vendor/VendorInvoice';
import VendorAddresses from '../pages/vendor/VendorAddresses';
import VendorSaved from '../pages/vendor/VendorSaved';
import VendorNotifications from '../pages/vendor/VendorNotifications';
import VendorProfile from '../pages/vendor/VendorProfile';
import VendorAbout from '../pages/vendor/VendorAbout';

// --- Delivery ----------------------------------------------------------------
import DeliveryDashboard from '../pages/delivery/DeliveryDashboard';
import DeliveryTaskDetail from '../pages/delivery/DeliveryTaskDetail';
import DeliveryHistory from '../pages/delivery/DeliveryHistory';
import DeliveryProfile from '../pages/delivery/DeliveryProfile';

// --- Outlet ------------------------------------------------------------------
import OutletDashboard from '../pages/outlet/OutletDashboard';
import OutletStock from '../pages/outlet/OutletStock';
import OutletMedicineDetail from '../pages/outlet/OutletMedicineDetail';
import OutletBilling from '../pages/outlet/OutletBilling';
import OutletOrders from '../pages/outlet/OutletOrders';
import OutletOrderDetail from '../pages/outlet/OutletOrderDetail';
import OutletManualOrder from '../pages/outlet/OutletManualOrder';
import OutletProfile from '../pages/outlet/OutletProfile';

// --- Agent -------------------------------------------------------------------
import AgentDashboard from '../pages/agent/AgentDashboard';
import AgentOrderDetail from '../pages/agent/AgentOrderDetail';
import AgentProfile from '../pages/agent/AgentProfile';

/** Wraps a role segment in its guard + dashboard shell. */
const guarded = (role, children) => ({
  element: (
    <ProtectedRoute allow={role}>
      <DashboardLayout />
    </ProtectedRoute>
  ),
  children,
});

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },

      // --- Public ------------------------------------------------------------
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'register/success', element: <RegisterSuccessPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
        ],
      },

      // --- Admin -------------------------------------------------------------
      {
        path: 'admin',
        ...guarded(ROLES.ADMIN, [
          { index: true, element: <AdminDashboard /> },
          { path: 'vendors', element: <AdminVendors /> },
          { path: 'vendors/:id', element: <AdminVendorDetail /> },
          { path: 'orders', element: <AdminOrders /> },
          { path: 'orders/:id', element: <AdminOrderDetail /> },
          { path: 'products', element: <AdminProducts /> },
          { path: 'users', element: <AdminUsers /> },
          { path: 'delivery', element: <AdminDelivery /> },
          { path: 'analytics', element: <AdminAnalytics /> },
          { path: 'disputes', element: <AdminDisputes /> },
          { path: 'deletion-requests', element: <AdminDeletionRequests /> },
          { path: 'settings', element: <AdminSettings /> },
        ]),
      },

      // --- Marketing ---------------------------------------------------------
      {
        path: 'marketing',
        ...guarded(ROLES.MARKETING, [
          { index: true, element: <MarketingDashboard /> },
          { path: 'products', element: <MarketingProducts /> },
          { path: 'products/new', element: <MarketingProductEditor /> },
          { path: 'products/bulk', element: <MarketingBulkUpload /> },
          { path: 'products/:id', element: <MarketingProductEditor /> },
          { path: 'batches', element: <MarketingBatches /> },
          { path: 'orders', element: <MarketingOrders /> },
          { path: 'orders/manual', element: <MarketingManualOrder /> },
          { path: 'orders/:id', element: <MarketingOrderDetail /> },
          { path: 'outlets', element: <MarketingOutlets /> },
          { path: 'outlets/new', element: <MarketingOutletRegister /> },
          { path: 'outlets/assign-stock', element: <MarketingAssignStock /> },
          { path: 'agents', element: <MarketingAgents /> },
          { path: 'agents/new', element: <MarketingAgentRegister /> },
          { path: 'coupons', element: <MarketingCoupons /> },
          { path: 'banners', element: <MarketingBanners /> },
          { path: 'notifications', element: <MarketingNotifications /> },
          { path: 'notifications/new', element: <MarketingNotificationComposer /> },
          { path: 'reports', element: <MarketingReports /> },
        ]),
      },

      // --- Vendor (storefront shell, not a dashboard) ------------------------
      {
        path: 'shop',
        element: (
          <ProtectedRoute allow={ROLES.VENDOR}>
            <StorefrontLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <VendorHome /> },
          // /shop/products (the old Catalogue) now lives on the storefront home.
          { path: 'products', element: <Navigate to="/shop" replace /> },
          { path: 'products/:id', element: <VendorProductDetail /> },
          { path: 'cart', element: <VendorCart /> },
          { path: 'checkout', element: <VendorCheckout /> },
          { path: 'orders', element: <VendorOrders /> },
          { path: 'orders/:id', element: <VendorOrderDetail /> },
          { path: 'orders/:id/invoice', element: <VendorInvoice /> },
          { path: 'addresses', element: <VendorAddresses /> },
          { path: 'saved', element: <VendorSaved /> },
          { path: 'notifications', element: <VendorNotifications /> },
          { path: 'profile', element: <VendorProfile /> },
          { path: 'about', element: <VendorAbout /> },
        ],
      },

      // --- Delivery ----------------------------------------------------------
      {
        path: 'delivery',
        ...guarded(ROLES.DELIVERY, [
          { index: true, element: <DeliveryDashboard /> },
          { path: 'tasks/:id', element: <DeliveryTaskDetail /> },
          { path: 'history', element: <DeliveryHistory /> },
          { path: 'profile', element: <DeliveryProfile /> },
        ]),
      },

      // --- Outlet ------------------------------------------------------------
      {
        path: 'outlet',
        ...guarded(ROLES.OUTLET, [
          { index: true, element: <OutletDashboard /> },
          { path: 'stock', element: <OutletStock /> },
          { path: 'stock/:id', element: <OutletMedicineDetail /> },
          { path: 'billing', element: <OutletBilling /> },
          { path: 'orders', element: <OutletOrders /> },
          { path: 'orders/new', element: <OutletManualOrder /> },
          { path: 'orders/:id', element: <OutletOrderDetail /> },
          { path: 'profile', element: <OutletProfile /> },
        ]),
      },

      // --- Area agent --------------------------------------------------------
      {
        path: 'agent',
        ...guarded(ROLES.AGENT, [
          { index: true, element: <AgentDashboard /> },
          { path: 'orders/:id', element: <AgentOrderDetail /> },
          { path: 'profile', element: <AgentProfile /> },
        ]),
      },

      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default router;
