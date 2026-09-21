import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCreditCard, FiHeadphones, FiShoppingBag, FiTruck } from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../i18n';
import { getProducts, getCategories, fullUrl } from '../api';
import Slideshow from '../components/Slideshow';
import CategoryNav from '../components/CategoryNav';
import ProductCard from '../components/ProductCard';
import ProductRow from '../components/ProductRow';
import ShopSearchBar from '../components/ShopSearchBar';

export default function ShopHome() {
  const { shop } = useShop();
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shop) return;
    setLoading(true);
    Promise.all([
      getProducts(shop.id, { featured_only: true }),
      getProducts(shop.id),
      getCategories(shop.id),
    ])
      .then(([feat, prods, cats]) => {
        setFeatured(feat);
        setAllProducts(prods);
        setCategories(cats);
      })
      .catch(() => {
        setFeatured([]);
        setAllProducts([]);
        setCategories([]);
      })
      .finally(() => setLoading(false));
  }, [shop]);

  if (!shop) return null;
  const isDigitalStore = shop.store_type === 'digital' || allProducts.some((product) => product.metadata?.product_type === 'digital');

  return (
    <div>
      {/* Full-width search bar — shop home page only */}
      <ShopSearchBar />

      {/* Categories — sticky single-row left/right scroll */}
      {categories.length > 0 && <CategoryNav categories={categories} />}

      {/* Hero slideshow — contained to match the page content width */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Slideshow slides={[shop.banner, ...(shop.slideshow || [])].filter(Boolean)} />
      </div>

      {/* Digital stores may promote offers; clothing stores keep a normal product grid. */}
      {isDigitalStore && !loading && allProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-6">
          <div className={`overflow-hidden rounded-2xl border shadow-lg ${isDark ? 'border-slate-700 bg-slate-950 text-white' : 'border-blue-100 bg-white text-slate-900'}`}>
            <div className="overflow-hidden py-3">
              <div className="promo-marquee flex w-max items-center gap-4">
                {[...allProducts, ...allProducts].map((product, index) => (
                  <Link key={`${product.id}-${index}`} to={`/${shop.username}/product/${product.id}`} className={`flex items-center gap-3 rounded-xl px-3 py-2 whitespace-nowrap ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-50 hover:bg-blue-50'}`}>
                    <div className={`h-12 w-12 overflow-hidden rounded-lg ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                      {product.images?.[0] && <img src={fullUrl(product.images[0])} alt={product.name} className="h-full w-full object-cover" />}
                    </div>
                    <span className="font-bold text-blue-700 dark:text-white">{product.name}</span>
                    <span className="font-black text-blue-600 dark:text-amber-300">${Number(product.sale_price ?? product.price).toFixed(2)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Categories moved to the sticky strip at the top */}

      {/* Featured products */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold dark:text-gray-100">{t('featuredProducts')}</h2>
          <Link to={`/${shop.username}/products`} className="text-primary font-semibold hover:underline text-sm">
            {t('viewAll')} →
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse">
                <div className="aspect-square bg-gray-200 blur-[2px] flex items-center justify-center">
                  <FiShoppingBag className="w-12 h-12 text-gray-300" />
                </div>
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-gray-200 blur-[1px] rounded w-3/4" />
                  <div className="h-4 bg-gray-200 blur-[1px] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <p className="text-gray-400 text-center py-10">{t('noFeatured')}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* Products grouped by category — 1 category = 1 row */}
      {loading ? null : (
        <>
          {categories.map((cat) => {
            const items = allProducts.filter((p) => p.category_id === cat.id);
            if (items.length === 0) return null;
            return (
              <section key={cat.id} className="max-w-7xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold dark:text-gray-100">{cat.name}</h2>
                  <Link to={`/${shop.username}/products?category=${cat.id}`} className="text-primary font-semibold hover:underline text-sm">
                    {t('viewAll')} →
                  </Link>
                </div>
                <ProductRow products={items} />
              </section>
            );
          })}

          {/* Un-categorized products */}
          {(() => {
            const catIds = new Set(categories.map((c) => c.id));
            const others = allProducts.filter((p) => !catIds.has(p.category_id));
            if (others.length === 0) return null;
            return (
              <section className="max-w-7xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold dark:text-gray-100">{t('products')}</h2>
                  <Link to={`/${shop.username}/products`} className="text-primary font-semibold hover:underline text-sm">
                    {t('viewAll')} →
                  </Link>
                </div>
                <ProductRow products={others} />
              </section>
            );
          })()}
        </>
      )}

      {/* About strip */}
      {shop.store_type === 'clothing' && (shop.shipping_settings?.carrier || shop.shipping_settings?.address || shop.shipping_settings?.phone) && (
        <section className="max-w-7xl mx-auto px-4 py-6">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-center">
            <h2 className="font-bold text-blue-900">ការដឹកជញ្ជូន</h2>
            <p className="text-sm text-blue-800 mt-2">
              {[shop.shipping_settings.carrier, shop.shipping_settings.address, shop.shipping_settings.phone].filter(Boolean).join(' · ')}
            </p>
          </div>
        </section>
      )}

      <section className="bg-white dark:bg-gray-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-6 text-center">
          <div className="p-6">
            <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
              <FiTruck className="w-6 h-6" />
            </div>
            <h3 className="font-bold mb-2 dark:text-gray-100">{t('fastDelivery')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('fastDeliveryDesc')}</p>
          </div>
          <div className="p-6">
            <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <FiCreditCard className="w-6 h-6" />
            </div>
            <h3 className="font-bold mb-2 dark:text-gray-100">{t('abaAccepted')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('abaAcceptedDesc')}</p>
          </div>
          <div className="p-6">
            <div className="w-12 h-12 mx-auto rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center mb-3">
              <FiHeadphones className="w-6 h-6" />
            </div>
            <h3 className="font-bold mb-2 dark:text-gray-100">{t('support')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('supportDesc')}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
