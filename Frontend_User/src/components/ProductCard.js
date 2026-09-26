import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiArrowUpRight, FiHeadphones, FiShield, FiShoppingBag, FiZap } from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { fullUrl } from '../api';

export default function ProductCard({ product, variant = 'standard' }) {
  const { shop } = useShop();
  const [imageFailed, setImageFailed] = useState(false);
  const price = product.sale_price ?? product.price;
  const hasSale = product.sale_price != null && product.sale_price < product.price;
  const discount = hasSale ? Math.round((1 - price / product.price) * 100) : 0;
  const metadata = product.metadata || {};
  const isKaidoStore = shop?.username?.toLowerCase() === 'kaidostore';
  const description = (product.description || '').replace(/\s+/g, ' ').trim();
  const isDigital = metadata.product_type === 'digital';
  const isManualService = metadata.fulfillment_type === 'manual_service';
  const isAvailable = isManualService ? !metadata.manual_service_out_of_stock : product.quantity > 0;

  if (isKaidoStore && variant === 'kaido-list') {
    const productLink = `/${shop.username}/product/${product.id}`;

    return (
      <article className="kaido-promo-card">
        <Link to={productLink} className="kaido-promo-artwork" aria-label={`View ${product.name}`}>
          {product.images?.[0] && !imageFailed ? (
            <img src={fullUrl(product.images[0])} alt={product.name} onError={() => setImageFailed(true)} />
          ) : (
            <span><FiShoppingBag /></span>
          )}
        </Link>

        <div className="kaido-promo-info">
          <p className="kaido-promo-category">{product.category_name || 'Game account'}</p>
          <Link to={productLink}><h3>{product.name}</h3></Link>
          <p className="kaido-promo-description">{description || 'A verified game account, ready for its next player.'}</p>
          <div className="kaido-promo-price">
            <strong>${Number(price).toFixed(2)}</strong>
            <span>{shop.currency}</span>
            {hasSale && <del>${Number(product.price).toFixed(2)}</del>}
          </div>
        </div>

        <ul className="kaido-promo-benefits" aria-label="Purchase benefits">
          <li><FiZap /><span>Instant access</span></li>
          <li><FiShield /><span>100% safe</span></li>
          <li><FiHeadphones /><span>Support</span></li>
        </ul>

        <div className="kaido-promo-action">
          <small className={isAvailable ? 'kaido-stock-available' : 'kaido-stock-sold'}>
            {isAvailable ? 'Ready to play' : 'Currently unavailable'}
          </small>
          {isAvailable ? (
            <Link to={productLink}>Buy Now <FiArrowRight /></Link>
          ) : (
            <span>Sold out</span>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className={`store-product-card store-product-card-${variant} ${isKaidoStore ? 'kaido-account-card' : ''} bg-white dark:bg-gray-800 overflow-hidden transition group flex flex-col h-full`}>
      <Link to={`/${shop.username}/product/${product.id}`} className="block relative">
        <div className="store-product-image aspect-[1.35/1] bg-slate-100 dark:bg-gray-700 overflow-hidden">
          {product.images?.[0] && !imageFailed ? <img src={fullUrl(product.images[0])} alt={product.name} className="w-full h-full object-cover bg-slate-50 group-hover:scale-105 transition duration-300" onError={() => setImageFailed(true)} /> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-blue-500"><FiShoppingBag className="w-10 h-10" /></div>}
        </div>
        {!isKaidoStore && hasSale && <span className="store-sale-badge absolute top-3 right-3">SALE -{discount}%</span>}
        {!isKaidoStore && product.featured && <span className="store-hot-badge absolute top-3 left-3">HOT</span>}
      </Link>
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.1em] truncate">{product.category_name || 'Rovistar item'}</p>
          <FiArrowUpRight className="text-slate-400 shrink-0" />
        </div>
        <Link to={`/${shop.username}/product/${product.id}`}>
          <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white mt-2 line-clamp-2 group-hover:text-blue-700 transition leading-snug">{product.name}</h3>
        </Link>
        <p className="text-xs text-slate-500 dark:text-gray-400 mt-2 line-clamp-2 min-h-[32px]">{description || (isDigital ? 'Digital access after payment.' : 'Quality product from this shop.')}</p>
        {!isManualService && (
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-blue-700">${Number(price).toFixed(2)}</span>
            <span className="text-[10px] font-bold text-slate-400">{shop.currency}</span>
            {hasSale && <span className="text-xs text-slate-400 line-through">${Number(product.price).toFixed(2)}</span>}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-bold">
          <span className={isAvailable ? 'text-emerald-600' : 'text-rose-600'}>{isAvailable ? '● Available' : '● Sold out'}</span>
          <span className="text-slate-400">{isManualService ? 'Manual service' : (isDigital ? 'Instant access' : 'Ready to order')}</span>
        </div>
        {isManualService && (isAvailable ? (
          <Link to={`/${shop.username}/product/${product.id}`} className="mt-4 w-full rounded-full bg-blue-600 py-2.5 text-center text-xs sm:text-sm font-black text-white shadow-sm transition hover:bg-blue-700">ចូលមើលទំនិញ</Link>
        ) : (
          <span className="mt-4 w-full rounded-xl bg-slate-200 py-2.5 text-center text-xs sm:text-sm font-black text-slate-400">Out of stock</span>
        ))}
        {!isManualService && (isAvailable ? (
          <Link to={`/${shop.username}/product/${product.id}`} className="mt-4 w-full rounded-full bg-blue-600 py-2.5 text-center text-xs sm:text-sm text-white font-black shadow-sm transition hover:bg-blue-700">ចូលមើលទំនិញ</Link>
        ) : (
          <span className="mt-4 w-full rounded-xl bg-slate-200 py-2.5 text-center text-xs sm:text-sm font-black text-slate-400">Sold out</span>
        ))}
      </div>
    </article>
  );
}
