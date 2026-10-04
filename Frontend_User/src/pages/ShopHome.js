import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight, FiCreditCard, FiGift, FiHeadphones, FiMessageCircle, FiSend, FiShield, FiShoppingBag, FiSmartphone, FiUser,
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
  const catalogProducts = allProducts.filter((product) => product.metadata?.fulfillment_type !== 'manual_service');
  const telegramGiftProducts = catalogProducts.filter((product) => product.metadata?.product_type === 'telegram_gift');
  const featuredProducts = (featured.length ? featured : catalogProducts)
    .filter((product) => product.metadata?.fulfillment_type !== 'manual_service')
    .slice(0, 4);
  const getValidDiscount = (product) => {
    const originalPrice = Number(product.price);
    const salePrice = Number(product.sale_price);
    if (product.sale_price == null || !Number.isFinite(originalPrice) || !Number.isFinite(salePrice)
      || originalPrice <= 0 || salePrice <= 0 || salePrice >= originalPrice) return null;
    const discount = Math.round((1 - salePrice / originalPrice) * 100);
    return discount >= 1 && discount <= 99 ? discount : null;
  };
  const flashSaleProducts = catalogProducts.filter((product) => getValidDiscount(product) !== null).slice(0, 8);

  const isDomi = shop.username?.toLowerCase() === 'domi';
  const isKaidoStore = shop.username?.toLowerCase() === 'kaidostore';
  const supportLink = shop.social_media?.telegram
    || (typeof shop.contact === 'string' && shop.contact.includes('t.me') ? shop.contact : 'https://t.me/kaidokmglaor');
  const appearance = shop.theme?.appearance || {};
  const productRailClass = appearance.product_direction === 'right' ? 'domi-rail-right' : 'domi-rail-left';
  const kaidoTrustFeatures = [
    {
      id: 'verified',
      icon: FiShield,
      title: 'Verified Accounts',
      copy: 'Every account is checked before listing.',
      label: 'Verified by Kaido',
      robotPose: 'guard',
    },
    {
      id: 'payment',
      icon: FiCreditCard,
      title: 'Secure KHQR Payment',
      copy: 'Pay safely with instant payment confirmation.',
      label: 'Protected checkout',
      robotPose: 'scan',
    },
    {
      id: 'delivery',
      icon: FiZap,
      title: 'Instant Delivery',
      copy: 'Receive your account details after payment.',
      label: 'Ready after payment',
      robotPose: 'deliver',
    },
  ];

  return (
    <div className={isKaidoStore ? 'kaido-storefront' : `domi-storefront marquee-text-${appearance.text_color || 'default'}`} data-palette={appearance.palette || 'rose'} style={{ '--section-kicker': appearance.section_kicker_color || '#b88712', '--section-title': appearance.section_title_color || '#d62468', '--section-accent': appearance.section_accent_color || '#1677db' }}>
      <ShopSearchBar />
      {!loading && telegramGiftProducts.length > 0 && (
        <nav className="telegram-gift-menu" aria-label="Telegram Gift collection">
          <a href="#telegram-gifts"><FiGift /><span>Telegram Gifts</span><b>{telegramGiftProducts.length}</b></a>
          <span>Choose a collectible, pay securely, receive its original Telegram link.</span>
        </nav>
      )}
      {categories.length > 0 && <div className={isKaidoStore ? 'kaido-top-category-nav' : ''}><CategoryNav categories={categories} products={allProducts} /></div>}

      {slides.length > 0 && (
        <section className={`${isKaidoStore ? 'kaido-banner-wrap' : 'max-w-7xl mx-auto px-4 pt-6 md:pt-8'}`}>
          <Slideshow slides={slides} />
        </section>
      )}

      {!loading && telegramGiftProducts.length > 0 && (
        <section id="telegram-gifts" className="telegram-gift-showcase" aria-labelledby="telegram-gifts-title">
          <div className="telegram-gift-showcase-heading">
            <div>
              <span><FiSend /> TELEGRAM COLLECTIBLES</span>
              <h2 id="telegram-gifts-title">Pick a gift that feels personal.</h2>
              <p>Choose your collectible, pay through the store, and get the original t.me gift link in Telegram after payment.</p>
            </div>
            <div className="telegram-gift-delivery-note"><FiZap /><span><b>Paid orders only</b><small>Delivered by the shop bot</small></span></div>
          </div>
          <div className="telegram-gift-grid">
            {telegramGiftProducts.map((product) => <ProductCard key={product.id} product={product} variant="telegram-gift" />)}
          </div>
        </section>
      )}

      {isKaidoStore && (
        <section className="kaido-service-strip" aria-label="Kaido Store benefits">
          <div><FiZap /><span><b>INSTANT DELIVERY</b><small>Ready after payment</small></span></div>
          <div><FiShield /><span><b>SAFE & SECURE</b><small>Verified accounts</small></span></div>
          <div><FiHeadphones /><span><b>24/7 SUPPORT</b><small>Here when you need us</small></span></div>
        </section>
      )}

      {isKaidoStore && !loading && (
        <section className="kaido-classic-products" aria-labelledby="kaido-classic-products-title">
          <div className="kaido-classic-heading">
            <div>
              <span>BROWSE EVERYTHING</span>
              <h2 id="kaido-classic-products-title">All Products</h2>
            </div>
            <Link to={`/${shop.username}/products`}>{t('viewAll')} →</Link>
          </div>
          {allProducts.length ? (
            <div className="kaido-popular-grid">
              {allProducts.map((product) => <ProductCard key={product.id} product={product} variant="kaido-popular" />)}
            </div>
          ) : <p className="kaido-filter-empty">{t('noFeatured')}</p>}
        </section>
      )}

      {isDigitalStore && !isKaidoStore && !loading && allProducts.length > 1 && (
        <section className="mx-auto max-w-7xl px-4 pt-5">
          <div className={`overflow-hidden rounded-2xl border ${isDark ? 'border-slate-700 bg-slate-950 text-white' : 'border-blue-100 bg-white text-slate-900'}`}>
            <div className="overflow-hidden py-3">
              <div className={`promo-marquee promo-marquee-${appearance.product_direction === 'right' ? 'right' : 'left'} flex w-max items-center gap-3`} style={{ '--promo-duration': appearance.product_speed === 'fast' ? '10s' : appearance.product_speed === 'normal' ? '18s' : '28s' }}>
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
                  <div className="flash-sale-copy min-w-0 flex-1">
                    {!isKaidoStore && <span className="flash-sale-label">FLASH DEAL</span>}
                    <h3>{product.name}</h3>
                    <span className="flash-sale-seller"><FiUser /> admin</span>
                    <div className="flash-sale-price-row">
                      <strong>${salePrice.toFixed(2)}</strong>
                      <del>${originalPrice.toFixed(2)}</del>
                    </div>
                  </div>
                  <span className="flash-sale-arrow"><FiArrowRight /></span>
                  {!isKaidoStore && <span className="flash-sale-discount">-{discount}%</span>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {isKaidoStore && !loading && (
        <section className="kaido-trust-section" aria-labelledby="kaido-trust-title">
          <div className="kaido-trust-heading">
            <div>
              <span><FiZap /> The Kaido promise</span>
              <h2 id="kaido-trust-title">Built for a safer game account purchase.</h2>
            </div>
            {supportLink && (
              <a className="kaido-support-link" href={supportLink} target="_blank" rel="noreferrer">
                <FiMessageCircle />
                <span><b>Need help?</b><small>Chat with Kaido support</small></span>
              </a>
            )}
          </div>
          <div className="kaido-trust-grid">
            {kaidoTrustFeatures.map(({ id, icon: Icon, title, copy, label, robotPose }) => (
              <article key={id} className={`kaido-trust-card kaido-trust-card-${id}`}>
                <div className={`kaido-robot kaido-robot-${robotPose}`} aria-hidden="true">
                  <span className="kaido-robot-antenna" />
                  <span className="kaido-robot-head"><i /><i /></span>
                  <span className="kaido-robot-arm kaido-robot-arm-left" />
                  <span className="kaido-robot-arm kaido-robot-arm-right" />
                  <span className="kaido-robot-body"><i /></span>
                  <span className="kaido-robot-leg kaido-robot-leg-left" />
                  <span className="kaido-robot-leg kaido-robot-leg-right" />
                </div>
                <div className="kaido-trust-icon"><Icon /></div>
                <div className="kaido-trust-copy">
                  <p>{title}</p>
                  <h3>{copy}</h3>
                  <span>{label}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!isKaidoStore && <section className="max-w-7xl mx-auto px-4 pt-10 md:pt-14 pb-7">
        <div className="store-section-heading">
          <div>
            <span className="store-section-kicker">Browse everything</span>
            <h2>All Products</h2>
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
        ) : allProducts.length === 0 ? (
          <p className="text-gray-400 text-center py-10">{t('noProducts')}</p>
        ) : (
          <div className={isKaidoStore ? 'kaido-account-grid' : 'grid grid-cols-2 md:grid-cols-4 gap-4'}>
            {allProducts.map((product) => <ProductCard key={product.id} product={product} variant="popular" />)}
          </div>
        )}
      </section>}

      {!isKaidoStore && !loading && categories.map((category) => {
        const items = catalogProducts.filter((product) => product.category_id === category.id);
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
        const others = catalogProducts.filter((product) => !categoryIds.has(product.category_id));
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
