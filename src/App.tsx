import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { SettingsProvider } from './context/SettingsContext'
import { ToastProvider } from './context/ToastContext'
import { Layout } from './components/layout/Layout'
import { AdminRoute, ProtectedRoute } from './components/layout/ProtectedRoute'
import { Spinner } from './components/ui'
import { trackEvent } from './lib/api'

import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderPage from './pages/OrderPage'
import TrackOrderPage from './pages/TrackOrderPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import DashboardHome from './pages/dashboard/DashboardHome'
import MyOrdersPage from './pages/dashboard/MyOrdersPage'
import OrderDetailPage from './pages/dashboard/OrderDetailPage'
import ProfilePage from './pages/dashboard/ProfilePage'
import SupportPage from './pages/dashboard/SupportPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import FaqPage from './pages/FaqPage'
import OffersPage from './pages/OffersPage'
import GamesPage from './pages/GamesPage'
import LegalPage from './pages/LegalPage'
import NotFoundPage from './pages/NotFoundPage'

/* Admin bundle is code-split so storefront visitors never download it. */
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'))
const AdminSetupPage = lazy(() => import('./pages/admin/AdminSetupPage'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'))
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'))
const AdminPromotions = lazy(() => import('./pages/admin/AdminPromotions'))
const AdminHomepage = lazy(() => import('./pages/admin/AdminHomepage'))
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'))
const AdminContent = lazy(() => import('./pages/admin/AdminContent'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))
const AdminSupport = lazy(() => import('./pages/admin/AdminSupport'))
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'))

function PageViewTracker() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Keep admin activity out of public storefront analytics.
    if (pathname.startsWith('/admin')) return

    try {
      const storageKey = 'nexora.analytics.visitor'
      let visitorId = window.sessionStorage.getItem(storageKey)
      if (!visitorId) {
        visitorId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`
        window.sessionStorage.setItem(storageKey, visitorId)
      }
      void trackEvent('page_view', { visitor_id: visitorId })
    } catch {
      // Analytics is optional and must never interrupt storefront navigation.
    }
  }, [pathname])

  return null
}

function PageFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner label="Loading…" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <PageViewTracker />
      <SettingsProvider>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <Routes>
                <Route path="admin/login" element={<Suspense fallback={<PageFallback />}><AdminLoginPage /></Suspense>} />
                <Route path="admin/setup" element={<Suspense fallback={<PageFallback />}><AdminSetupPage /></Suspense>} />
                <Route element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="products" element={<ProductsPage />} />
                  <Route path="category/:slug" element={<ProductsPage />} />
                  <Route path="offers" element={<OffersPage />} />
                  <Route path="games" element={<GamesPage />} />
                  <Route path="product/:slug" element={<ProductDetailPage />} />
                  <Route path="cart" element={<CartPage />} />
                  <Route path="checkout" element={<CheckoutPage />} />
                  <Route path="order/:orderNumber" element={<OrderPage />} />
                  <Route path="track" element={<TrackOrderPage />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="register" element={<RegisterPage />} />
                  <Route path="about" element={<AboutPage />} />
                  <Route path="contact" element={<ContactPage />} />
                  <Route path="faq" element={<FaqPage />} />
                  <Route path="privacy" element={<LegalPage kind="privacy" />} />
                  <Route path="terms" element={<LegalPage kind="terms" />} />
                  <Route path="refund" element={<LegalPage kind="refund" />} />

                  <Route
                    path="dashboard"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<DashboardHome />} />
                    <Route path="orders" element={<MyOrdersPage />} />
                    <Route path="orders/:orderNumber" element={<OrderDetailPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="support" element={<SupportPage />} />
                  </Route>

                  <Route
                    path="admin"
                    element={
                      <AdminRoute>
                        <Suspense fallback={<PageFallback />}>
                          <AdminLayout />
                        </Suspense>
                      </AdminRoute>
                    }
                  >
                    <Route
                      index
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <AdminDashboard />
                        </Suspense>
                      }
                    />
                    <Route
                      path="analytics"
                      element={<Suspense fallback={<PageFallback />}><AdminAnalytics /></Suspense>}
                    />
                    <Route
                      path="products"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <AdminProducts />
                        </Suspense>
                      }
                    />
                    <Route
                      path="categories"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <AdminCategories />
                        </Suspense>
                      }
                    />
                    <Route
                      path="orders"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <AdminOrders />
                        </Suspense>
                      }
                    />
                    <Route
                      path="customers"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <AdminCustomers />
                        </Suspense>
                      }
                    />
                    <Route
                      path="homepage"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <AdminHomepage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="promotions"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <AdminPromotions />
                        </Suspense>
                      }
                    />
                    <Route
                      path="coupons"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <AdminCoupons />
                        </Suspense>
                      }
                    />
                    <Route
                      path="content"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <AdminContent />
                        </Suspense>
                      }
                    />
                    <Route
                      path="reviews"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <AdminReviews />
                        </Suspense>
                      }
                    />
                    <Route
                      path="support"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <AdminSupport />
                        </Suspense>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <AdminSettings />
                        </Suspense>
                      }
                    />
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}
