import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import ProductForm from './pages/ProductForm';
import Categories from './pages/Categories';
import Stock from './pages/Stock';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Customers from './pages/Customers';
import ShopSettings from './pages/ShopSettings';
import PaymentSettings from './pages/PaymentSettings';
import TelegramSettings from './pages/TelegramSettings';
import Backup from './pages/Backup';
import Reports from './pages/Reports';
import Receipts from './pages/Receipts';
import UpgradePlan from './pages/UpgradePlan';
import KHSMMServices from './pages/KHSMMServices';
import CustomerChat from './pages/CustomerChat';

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'shop_owner' && user.role !== 'staff') return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Layout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="settings" element={<ShopSettings />} />
          <Route path="customer-chat" element={<CustomerChat />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
