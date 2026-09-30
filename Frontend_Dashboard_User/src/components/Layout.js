import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiHome, FiLogOut, FiPackage, FiSettings, FiShoppingBag } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { getShopDetail } from '../api';

const navItems = [
  { to: '/', label: 'ផ្ទាំងគ្រប់គ្រង', icon: <FiHome />, end: true },
  { to: '/products', label: 'ផលិតផល', icon: <FiPackage /> },
  { to: '/settings', label: 'ការកំណត់ហាង', icon: <FiSettings /> },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [storeType, setStoreType] = useState('clothing');

  useEffect(() => {
    if (user?.shop_id) getShopDetail(user.shop_id).then((shop) => setStoreType(shop.store_type || 'clothing')).catch(() => {});
  }, [user?.shop_id]);

  return (
    <div className="flex min-h-screen">
      <aside className={`w-60 text-white flex flex-col fixed inset-y-0 ${storeType === 'digital' ? 'bg-gradient-to-b from-pink-950 to-slate-900' : 'bg-slate-900'}`}>
        <div className="p-5 border-b border-slate-700">
          <h1 className="font-bold text-lg flex items-center gap-2">
            <FiShoppingBag className="w-5 h-5" /> ROVISTAR MARKET
          </h1>
          <p className="text-xs text-slate-400">{storeType === 'digital' ? 'Digital Store Dashboard' : 'Clothing Store Dashboard'}</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive ? `${storeType === 'digital' ? 'bg-pink-500' : 'bg-blue-600'} text-white` : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              {item.icon} {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.username}</p>
              <p className="text-xs text-slate-400">Shop #{user?.shop_id}</p>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-300"
              title="Logout"
            >
              <FiLogOut />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-60 p-8">
        <Outlet />
      </main>
    </div>
  );
}
