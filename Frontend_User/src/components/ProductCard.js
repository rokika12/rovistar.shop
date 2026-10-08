import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiArrowUpRight, FiCheck, FiExternalLink, FiGift, FiHeadphones, FiHeart, FiShield, FiShoppingBag, FiZap } from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { fullUrl } from '../api';
import { useLanguage } from '../i18n';

export default function ProductCard({ product, variant = 'standard' }) {
  const { shop } = useShop();
  const { t } = useLanguage();
  const [imageFailed, setImageFailed] = useState(false);
  const originalPrice = Number(product.price);
  const proposedSalePrice = Number(product.sale_price);
  const proposedDiscount = product.sale_price != null
    && Number.isFinite(originalPrice)
    && Number.isFinite(proposedSalePrice)
    && originalPrice > 0
    && proposedSalePrice > 0
    && proposedSalePrice < originalPrice
    ? Math.round((1 - proposedSalePrice / originalPrice) * 100)
    : 0;
  const hasSale = proposedDiscount >= 1 && proposedDiscount <= 99;
  const price = hasSale ? proposedSalePrice : originalPrice;
  const discount = hasSale ? proposedDiscount : 0;
  const metadata = product.metadata || {};
  const isTelegramGift = metadata.product_type === 'telegram_gift';
  const isKaidoStore = shop?.username?.toLowerCase() === 'kaidostore';
  const isRovistarStore = shop?.username?.toLowerCase() === 'rovistar';
  const description = (product.description || '').replace(/\s+/g, ' ').trim();
  const isDigital = metadata.product_type === 'digital';
  const isManualService = metadata.fulfillment_type === 'manual_service';
  const isAvailable = isManualService ? !metadata.manual_service_out_of_stock : product.quantity > 0;

  if (isTelegramGift && variant === 'telegram-gift') {
    const productLink = `/${shop.username}/product/${product.id}`;
    const gift = metadata.telegram_gift || {};

    return (
      <article className="telegram-gift-card">
        <Link to={productLink} className="telegram-gift-card-main" aria-label={`Choose ${product.name}`}>
          <div className="telegram-gift-card-art">
            {product.images?.[0] && !imageFailed ? (
              <img src={fullUrl(product.images[0])} alt={product.name} onError={() => setImageFailed(true)} />
            ) : (
              <span className="telegram-gift-card-placeholder"><FiGift /></span>
            )}
            <span className="telegram-gift-card-live"><i /> Telegram collectible</span>
          </div>
          <div className="telegram-gift-card-copy">
            <p>{gift.collection || 'Telegram Gift'}{gift.gift_number ? ` · #${gift.gift_number}` : ''}</p>
            <h3>{product.name}</h3>
            <div><strong>${Number(price).toFixed(2)}</strong><small>{shop.currency}</small></div>
            <span className={isAvailable ? 'telegram-gift-card-buy' : 'telegram-gift-card-sold'}>
              {isAvailable ? <>Choose gift <FiArrowRight /></> : t('soldOut')}
            </span>
          </div>
        </Link>
        {gift.canonical_url && (
          <a className="telegram-gift-native-link" href={gift.canonical_url} target="_blank" rel="noreferrer">
            View native gift in Telegram <FiExternalLink />
          </a>
        )}
      </article>
    );
  }

  if (isKaidoStore && variant === 'kaido-popular') {
    const productLink = `/${shop.username}/product/${product.id}`;
    const accent = String(product.category_name || product.name).toLowerCase().includes('mlbb') ? 'blue' : 'pink';
    const priceLabel = `$${Number(price).toFixed(2)}`;
    const priceClass = priceLabel.length > 10
      ? 'kaido-popular-price-long'
      : priceLabel.length > 6 ? 'kaido-popular-price-wide' : '';

    return (
      <article className={`kaido-popular-card kaido-popular-card-${accent} ${priceClass}`}>
        <Link to={productLink} className="kaido-popular-image" aria-label={`View ${product.name}`}>
          {product.images?.[0] && !imageFailed ? <img src={fullUrl(product.images[0])} alt={product.name} onError={() => setImageFailed(true)} /> : <span><FiShoppingBag /></span>}
        </Link>
        <div className="kaido-popular-body">
          <span className="kaido-popular-category">{product.category_name || 'Rovistar item'}</span>
          <Link to={productLink}><h3>{product.name}</h3></Link>
          <p>{description || 'Digital access after payment.'}</p>
          <div className="kaido-popular-meta"><span className={isAvailable ? 'available' : 'sold'}>● {isAvailable ? 'Available' : 'Sold out'}</span><span>Instant access</span></div>
          <div className="kaido-popular-price"><strong>{priceLabel}</strong><small>{shop.currency || 'USD'}</small></div>
          {isAvailable ? <Link to={productLink} className="kaido-popular-buy">Buy Now <FiArrowRight /></Link> : <span className="kaido-popular-sold">Sold out</span>}
        </div>
      </article>
    );
  }

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

  if (isKaidoStore && variant === 'kaido-grid') {
    const productLink = `/${shop.username}/product/${product.id}`;

    return (
      <article className="kaido-game-card">
        <Link to={productLink} className="kaido-game-artwork" aria-label={`View ${product.name}`}>
          {product.images?.[0] && !imageFailed ? (
            <img src={fullUrl(product.images[0])} alt={product.name} onError={() => setImageFailed(true)} />
          ) : (
            <span><FiShoppingBag /></span>
          )}
          <span className="kaido-game-type">{product.category_name || 'Game account'}</span>
          {hasSale && <span className="kaido-game-sale">-{discount}%</span>}
        </Link>
        <div className="kaido-game-card-body">
          <Link to={productLink}><h3>{product.name}</h3></Link>
          <p>{description || 'Verified account with secure delivery after payment.'}</p>
          <div className="kaido-game-assurance"><FiCheck /> Verified for delivery</div>
          <div className="kaido-game-card-footer">
            <div><strong>${Number(price).toFixed(2)}</strong><small>{shop.currency}</small>{hasSale && <del>${Number(product.price).toFixed(2)}</del>}</div>
            {isAvailable ? <Link to={productLink}>View <FiArrowRight /></Link> : <span>Sold out</span>}
          </div>
        </div>
      </article>
    );
  }

  if (isKaidoStore && variant === 'kaido-discount') {
    const productLink = `/${shop.username}/product/${product.id}`;
    const status = product.featured ? 'POPULAR' : discount >= 25 ? 'BESTSELLER' : 'NEW';
    const cardDescription = description || product.category_name || '';

    return (
      <article className="kaido-discount-card">
        <Link to={productLink} className="kaido-discount-artwork" aria-label={`View ${product.name}`}>
          {product.images?.[0] && !imageFailed ? (
            <img src={fullUrl(product.images[0])} alt={product.name} onError={() => setImageFailed(true)} />
          ) : (
            <span><FiShoppingBag /></span>
          )}
        </Link>
        <div className="kaido-discount-card-body">
          <div className="kaido-discount-card-meta">
            <span>{status}</span>
            {hasSale && <b>-{discount}%</b>}
            <FiHeart aria-label="Game account" />
          </div>
          <Link to={productLink}><h3>{product.name}</h3></Link>
          {cardDescription && <p>{cardDescription}</p>}
          <div className="kaido-discount-chips" aria-label="Account service benefits">
            <span><FiZap /> Instant delivery</span>
            <span><FiShield /> Safe transfer</span>
          </div>
          <div className="kaido-discount-price">
            <div>
              <strong>${Number(price).toFixed(2)}</strong>
              <small>{shop.currency}</small>
              {hasSale && <del>${originalPrice.toFixed(2)}</del>}
            </div>
            <Link to={productLink}>ចូលមើលទំនិញ <FiArrowRight /></Link>
          </div>
        </div>
      </article>
    );
  }

  if (isRovistarStore) {
    const productLink = `/${shop.username}/product/${product.id}`;

    return (
      <article className={`store-product-card dz-product-card store-product-card-${variant} group`}>
        <Link to={productLink} className="dz-product-art" aria-label={`View ${product.name}`}>
          <div className="store-product-image">
            {product.images?.[0] && !imageFailed ? (
              <img src={fullUrl(product.images[0])} alt={product.name} loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
            ) : (
              <span className="dz-product-placeholder"><FiShoppingBag /></span>
            )}
          </div>
          {hasSale && <span className="store-sale-badge">SALE -{discount}%</span>}
          {product.featured && <span className="store-hot-badge">HOT</span>}
        </Link>
        <div className="dz-product-info">
          <Link to={productLink}><h3>{product.name}</h3></Link>
          <p className="dz-product-description">{description || (isDigital ? t('digitalAccess') : t('qualityProduct'))}</p>
          <div className="dz-product-price">
            <span>From</span>
            <strong>${Number(price).toFixed(2)}</strong>
            {hasSale && <del>${originalPrice.toFixed(2)}</del>}
          </div>
        </div>
        {isAvailable ? (
          <Link to={productLink} className="dz-product-buy">{t('viewProduct')} <FiArrowRight /></Link>
        ) : (
          <span className="dz-product-buy dz-product-sold">{t('soldOut')}</span>
        )}
      </article>
    );
  }

  return (
    <article className={`store-product-card store-product-card-${variant} ${isKaidoStore ? 'kaido-account-card kaido-compact-action-card' : ''} bg-white dark:bg-gray-800 overflow-hidden transition group flex flex-col h-full`}>
      <Link to={`/${shop.username}/product/${product.id}`} className="block relative">
        <div className="store-product-image aspect-[1.35/1] bg-slate-100 dark:bg-gray-700 overflow-hidden">
          {product.images?.[0] && !imageFailed ? <img src={fullUrl(product.images[0])} alt={product.name} className="w-full h-full object-cover bg-slate-50 group-hover:scale-105 transition duration-300" onError={() => setImageFailed(true)} /> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-blue-500"><FiShoppingBag className="w-10 h-10" /></div>}
        </div>
        {!isKaidoStore && hasSale && <span className="store-sale-badge absolute top-3 right-3">SALE -{discount}%</span>}
        {!isKaidoStore && product.featured && <span className="store-hot-badge absolute top-3 left-3">HOT</span>}
      </Link>
      {isTelegramGift && <div className="px-3 pt-3 sm:px-4"><span className="inline-flex rounded-full bg-blue-600 px-3 py-1 text-sm font-black text-white">${Number(price).toFixed(2)} {shop.currency}</span></div>}
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.1em] truncate">{product.category_name || t('rovistarItem')}</p>
          <FiArrowUpRight className="text-slate-400 shrink-0" />
        </div>
        <Link to={`/${shop.username}/product/${product.id}`}>
          <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white mt-2 line-clamp-2 group-hover:text-blue-700 transition leading-snug">{product.name}</h3>
        </Link>
        <p className="text-xs text-slate-500 dark:text-gray-400 mt-2 line-clamp-2 min-h-[32px]">{description || (isDigital ? t('digitalAccess') : t('qualityProduct'))}</p>
        <div className="mt-3 flex min-h-[36px] items-baseline gap-1.5">
          {!isManualService && !isTelegramGift && <>
            <span className="text-xl sm:text-2xl font-black text-blue-700">${Number(price).toFixed(2)}</span>
            <span className="text-[10px] font-bold text-slate-400">{shop.currency}</span>
            {hasSale && <span className="text-xs text-slate-400 line-through">${Number(product.price).toFixed(2)}</span>}
          </>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-bold">
          <span className={isAvailable ? 'text-emerald-600' : 'text-rose-600'}>{isAvailable ? `● ${t('available')}` : `● ${t('soldOut')}`}</span>
          <span className="text-slate-400">{isManualService ? t('manualService') : (isDigital ? t('instantAccess') : t('readyToOrder'))}</span>
        </div>
        {isManualService && (isAvailable ? (
          <Link to={`/${shop.username}/product/${product.id}`} className="mt-auto w-full rounded-full bg-blue-600 py-2.5 text-center text-xs sm:text-sm font-black text-white shadow-sm transition hover:bg-blue-700">{t('viewProduct')}</Link>
        ) : (
          <span className="mt-auto w-full rounded-xl bg-slate-200 py-2.5 text-center text-xs sm:text-sm font-black text-slate-400">{t('soldOut')}</span>
        ))}
        {!isManualService && (isAvailable ? (
          <Link to={`/${shop.username}/product/${product.id}`} className="mt-auto w-full rounded-full bg-blue-600 py-2.5 text-center text-xs sm:text-sm text-white font-black shadow-sm transition hover:bg-blue-700">{t('viewProduct')}</Link>
        ) : (
          <span className="mt-auto w-full rounded-xl bg-slate-200 py-2.5 text-center text-xs sm:text-sm font-black text-slate-400">{t('soldOut')}</span>
        ))}
      </div>
    </article>
  );
}
