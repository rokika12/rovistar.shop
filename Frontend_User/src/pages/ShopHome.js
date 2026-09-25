import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiCreditCard, FiHeadphones, FiShoppingBag, FiSmartphone,
  FiTruck, FiZap,
} from 'react-icons/fi';
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
      .then(([feat, products, cats]) => {
        setFeatured(feat);
        setAllProducts(products);
        setCategories(cats);
      })
      .catch(() => {
        setFeatured([]);
        setAllProducts([]);
        setCategories([]);
      })
      .finally(() => setLoading(false));
  }, [shop]);

  const isDigitalStore = shop?.template_type === 'account';
  const slides = useMemo(() => [shop?.banner, ...(shop?.slideshow || [])].filter(Boolean), [shop]);

  if (!shop) return null;
  const featuredProducts = featured.length ? featured : allProducts.slice(0, 4);
  const flashSaleProducts = allProducts.filter((product) => (
    product.sale_price != null && Number(product.sale_price) < Number(product.price)
  )).slice(0, 8);

  const isDomi = shop.username?.toLowerCase() === 'domi';
  const isKaidoStore = shop.username?.toLowerCase() === 'kaidostore';
  const appearance = shop.theme?.appearance || {};
  const productRailClass = appearance.product_direction === 'right' ? 'domi-rail-right' : 'domi-rail-left';

  return (
    <div className={`domi-storefront marquee-text-${appearance.text_color || 'default'}`} data-palette={appearance.palette || 'rose'} style={{ '--section-kicker': appearance.section_kicker_color || '#b88712', '--section-title': appearance.section_title_color || '#d62468', '--section-accent': appearance.section_accent_color || '#1677db' }}>
      <ShopSearchBar />
      {categories.length > 0 && <CategoryNav categories={categories} products={allProducts} />}

      {slides.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pt-6 md:pt-8">
          <Slideshow slides={slides} />
        </section>
      )}

      {isDigitalStore && !isKaidoStore && !loading && allProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-5">
          <div className={`overflow-hidden rounded-2xl border ${isDark ? 'border-slate-700 bg-slate-950 text-white' : 'border-blue-100 bg-white text-slate-900'}`}>
            <div className="overflow-hidden py-3">
              <div className={`promo-marquee promo-marquee-${appearance.product_direction === 'right' ? 'right' : 'left'} flex w-max items-center gap-3`} style={{ '--promo-duration': appearance.product_speed === 'fast' ? '7s' : appearance.product_speed === 'normal' ? '12s' : '20s' }}>
                {[...allProducts, ...allProducts].map((product, index) => (
                  <Link key={`${product.id}-${index}`} to={`/${shop.username}/product/${product.id}`} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 whitespace-nowrap ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-50 hover:bg-blue-50'}`}>
                    {appearance.show_marquee_images !== false && <div className={`h-10 w-10 overflow-hidden rounded-lg ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>{product.images?.[0] && <img src={fullUrl(product.images[0])} alt="" className="h-full w-full object-cover" />}</div>}
                    <span className="font-bold text-blue-700 dark:text-white">{product.name}</span>
                    <span className="font-black text-blue-600 dark:text-amber-300">${Number(product.sale_price ?? product.price).toFixed(2)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {!isKaidoStore && !loading && allProducts.length > 0 && appearance.show_product_marquee !== false && (
        <section className="domi-promo-rails" aria-label="Featured offers">
          <div className={`domi-rail marquee-product-text-${appearance.product_text_color || 'default'}`}><div className={`domi-rail-track ${productRailClass}`} style={{ '--rail-duration': appearance.product_speed === 'fast' ? '7s' : appearance.product_speed === 'normal' ? '12s' : '20s' }}>{Array.from({ length: 6 }, () => allProducts).flat().map((product, index) => <Link key={`product-${product.id}-${index}`} to={`/${shop.username}/product/${product.id}`}><span>{product.name}</span><b>VIEW</b></Link>)}</div></div>
        </section>
      )}

      {false && <section className="max-w-7xl mx-auto px-4 py-7">
        <div className="store-trust-grid">
          <div className="store-trust-card"><FiSmartphone /><strong>ងាយស្រួលប្រើ</strong><p>រកទំនិញ និងបញ្ជាទិញបានល្អទាំងទូរស័ព្ទ និងកុំព្យូទ័រ។</p></div>
          <div className="store-trust-card"><FiCreditCard /><strong>បង់ប្រាក់មានសុវត្ថិភាព</strong><p>ប្រើ ABA KHQR និងពិនិត្យស្ថានភាពការបង់ប្រាក់ដោយស្វ័យប្រវត្តិ។</p></div>
          <div className="store-trust-card"><FiTruck /><strong>តាមដានបានងាយ</strong><p>បើកគណនីមួយសម្រាប់ order, receipt និងព័ត៌មានទំនាក់ទំនង។</p></div>
        </div>
      </section>}

      {!isKaidoStore && !loading && !isDomi && flashSaleProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pt-2 pb-5">
          <div className="store-section-heading store-flash-heading">
            <div>
              <span className="store-section-kicker"><FiZap /> Limited-time prices</span>
              <h2>Flash Sale</h2>
            </div>
            <Link to={`/${shop.username}/products`}>{t('viewAll')} →</Link>
          </div>
          <div className="flash-sale-track no-scrollbar">
            {flashSaleProducts.map((product) => {
              const salePrice = Number(product.sale_price);
              const originalPrice = Number(product.price);
              const discount = Math.round((1 - salePrice / originalPrice) * 100);
              return (
                <Link key={product.id} to={`/${shop.username}/product/${product.id}`} className="flash-sale-card">
                  <div className="flash-sale-image">
                    {product.images?.[0] ? <img src={fullUrl(product.images[0])} alt={product.name} /> : <FiShoppingBag />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {!isKaidoStore && <span className="flash-sale-label">FLASH DEAL</span>}
                    <h3>{product.name}</h3>
                    <div className="flash-sale-price-row">
                      <strong>${salePrice.toFixed(2)}</strong>
                      <del>${originalPrice.toFixed(2)}</del>
                    </div>
                  </div>
                  {!isKaidoStore && <span className="flash-sale-discount">-{discount}%</span>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {isKaidoStore && !loading && allProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-6">
          <div className="kaido-account-grid">
            {allProducts.map((product) => <ProductCard key={product.id} product={product} variant="catalog" />)}
          </div>
        </section>
      )}

      {!isKaidoStore && <section className="max-w-7xl mx-auto px-4 pt-10 md:pt-14 pb-7">
        <div className="store-section-heading">
          <div>
            <span className="store-section-kicker">Picked for you</span>
            <h2>Popular Products</h2>
          </div>
          <Link to={`/${shop.username}/products`}>{t('viewAll')} →</Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-white rounded-2xl overflow-hidden border border-slate-100 animate-pulse">
                <div className="aspect-square bg-slate-100" />
                <div className="p-4 space-y-2"><div className="h-3 bg-slate-100 rounded w-3/4" /><div className="h-4 bg-slate-100 rounded w-1/2" /></div>
              </div>
            ))}
          </div>
        ) : featuredProducts.length === 0 ? (
          <p className="text-gray-400 text-center py-10">{t('noFeatured')}</p>
        ) : (
          <div className={isKaidoStore ? 'kaido-account-grid' : 'grid grid-cols-2 md:grid-cols-4 gap-4'}>
            {featuredProducts.map((product) => <ProductCard key={product.id} product={product} variant="popular" />)}
          </div>
        )}
      </section>}

      {!isKaidoStore && !loading && categories.map((category) => {
        const items = allProducts.filter((product) => product.category_id === category.id);
        if (!items.length) return null;
        return (
          <section key={category.id} className="max-w-7xl mx-auto px-4 py-6">
            <div className="store-section-heading">
              <h2>{category.name}</h2>
              <Link to={`/${shop.username}/products?category=${category.id}`}>{t('viewAll')} →</Link>
            </div>
            <ProductRow products={items} />
          </section>
        );
      })}

      {!isKaidoStore && !loading && (() => {
        const categoryIds = new Set(categories.map((category) => category.id));
        const others = allProducts.filter((product) => !categoryIds.has(product.category_id));
        if (!others.length) return null;
        return (
          <section className="max-w-7xl mx-auto px-4 py-6">
            <div className="store-section-heading"><h2>{t('products')}</h2><Link to={`/${shop.username}/products`}>{t('viewAll')} →</Link></div>
            <ProductRow products={others} />
          </section>
        );
      })()}

      {!isKaidoStore && shop.store_type === 'clothing' && (shop.shipping_settings?.carrier || shop.shipping_settings?.address || shop.shipping_settings?.phone) && (
        <section className="max-w-7xl mx-auto px-4 py-6">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-center">
            <h2 className="font-bold text-blue-900">ការដឹកជញ្ជូន</h2>
            <p className="text-sm text-blue-800 mt-2">{[shop.shipping_settings.carrier, shop.shipping_settings.address, shop.shipping_settings.phone].filter(Boolean).join(' · ')}</p>
          </div>
        </section>
      )}

      {!isKaidoStore && <section className="mt-8 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-6 text-center">
          <div className="p-6"><div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3"><FiTruck className="w-6 h-6" /></div><h3 className="font-bold mb-2 dark:text-gray-100">{t('fastDelivery')}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{t('fastDeliveryDesc')}</p></div>
          <div className="p-6"><div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3"><FiCreditCard className="w-6 h-6" /></div><h3 className="font-bold mb-2 dark:text-gray-100">{t('abaAccepted')}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{t('abaAcceptedDesc')}</p></div>
          <div className="p-6"><div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3"><FiHeadphones className="w-6 h-6" /></div><h3 className="font-bold mb-2 dark:text-gray-100">{t('support')}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{t('supportDesc')}</p></div>
        </div>
      </section>}
    </div>
  );
}
