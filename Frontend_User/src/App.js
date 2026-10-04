import React, { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { FiAlertTriangle } from 'react-icons/fi';
import { CartProvider } from './contexts/CartContext';
import { ShopProvider } from './contexts/ShopContext';
import { OwnerProvider } from './contexts/OwnerContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ShopLayout from './components/ShopLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { useLanguage } from './i18n';

// Keep the first storefront visit light; secondary screens load only when opened.
const CreateShop = lazy(() => import('./pages/CreateShop'));
const ShopHome = lazy(() => import('./pages/ShopHome'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const About = lazy(() => import('./pages/About'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const Profile = lazy(() => import('./pages/Profile'));
const InformationFeed = lazy(() => import('./pages/InformationFeed'));

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <CartProvider>
          <OwnerProvider>
            <Suspense fallback={<PageLoader />}>
            <Routes>
          <Route path="/" element={<ShopProvider directDomain><ShopLayout /></ShopProvider>}>
            <Route index element={<ShopHome />} />
            <Route path="products" element={<Products />} />
            <Route path="product/:id" element={<ProductDetail />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="order-success" element={<OrderSuccess />} />
            <Route path="my-orders" element={<MyOrders />} />
            <Route path="profile" element={<Profile />} />
            <Route path="information" element={<InformationFeed />} />
            <Route path="saved-information" element={<InformationFeed savedOnly />} />
            <Route path="about" element={<About />} />
          </Route>
          <Route path="/create-shop" element={<CreateShop />} />
          <Route
            path="/:username"
            element={
              <ShopProvider>
                <ShopLayout />
              </ShopProvider>
            }
          >
            <Route index element={<ShopHome />} />
            <Route path="products" element={<Products />} />
            <Route path="product/:id" element={<ProductDetail />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="order-success" element={<OrderSuccess />} />
            <Route path="my-orders" element={<MyOrders />} />
            <Route path="profile" element={<Profile />} />
            <Route path="information" element={<InformationFeed />} />
            <Route path="saved-information" element={<InformationFeed savedOnly />} />
            <Route path="about" element={<About />} />
          </Route>
          <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </OwnerProvider>
        </CartProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function PageLoader() {
  return <div className="min-h-screen bg-slate-50" aria-label="Loading page" />;
}

function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <FiAlertTriangle className="w-16 h-16 text-gray-300 mb-4" />
      <h1 className="text-4xl font-bold text-gray-800">404</h1>
      <p className="text-gray-500 mt-2">{t('notFound404')}</p>
      <a href="/" className="btn-primary mt-6 px-6 py-2 rounded-lg">{t('backHome')}</a>
    </div>
  );
}
