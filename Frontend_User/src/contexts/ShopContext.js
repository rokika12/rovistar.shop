import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getShop, getShopForDomain, fullUrl } from '../api';

const ShopContext = createContext(null);

const DEFAULT_THEME = {
  primary: '#ef3d78',
  secondary: '#2563eb',
  font_family: 'Nunito',
};

// The browser-tab icon (favicon) follows the active shop's logo.
// The default favicon link in index.html has data-default="true".
function setShopFavicon(logoUrl) {
  document.querySelectorAll('link[rel="icon"]:not([data-default])').forEach((l) => l.remove());
  if (logoUrl) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute('href', logoUrl);
    document.head.appendChild(link);
  }
}

export const ShopProvider = ({ children, directDomain = false }) => {
  const { username } = useParams();
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadShop = (shopUsername) => getShop(shopUsername)
      .then((data) => {
        setShop(data);
        const shopTitle = data.shop_name || data.username || 'Shop';
        document.title = `${shopTitle} | ROVISTAR MARKET`;
        setShopFavicon(data.logo ? fullUrl(data.logo) : null);
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
        meta.setAttribute('content', (data.description || data.bio || `Shop ${shopTitle} on ROVISTAR MARKET`).slice(0, 200));
        const theme = { ...DEFAULT_THEME, ...(data.theme || {}) };
        document.documentElement.style.setProperty('--primary', theme.primary);
        document.documentElement.style.setProperty('--secondary', theme.secondary);
        document.documentElement.style.setProperty('--brand-pink', theme.primary);
        document.documentElement.style.setProperty('--brand-blue', theme.secondary);
        document.documentElement.style.fontFamily = `'${theme.font_family}', 'Kantumruy Pro', sans-serif`;
      });
    if (!username && !directDomain) {
      setShop(null); setLoading(false); setError(null); document.title = 'ROVISTAR MARKET'; setShopFavicon(null); return;
    }
    setLoading(true);
    setError(null);
    setShop(null); // reset so we never show the previous shop's data while loading
    setShopFavicon(null);
    (username ? Promise.resolve({ username }) : getShopForDomain(window.location.hostname))
      .then((resolved) => loadShop(resolved.username))
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Shop not found');
        toast.error(err?.response?.data?.detail || 'Shop not found');
        setShopFavicon(null);
      })
      .finally(() => setLoading(false));
  }, [username, directDomain]);

  return (
    <ShopContext.Provider value={{ shop, loading, error, setShop }}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => useContext(ShopContext);
