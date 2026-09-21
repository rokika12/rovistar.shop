import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiShoppingBag, FiZap } from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { useCart } from '../contexts/CartContext';
import { fullUrl } from '../api';

export default function ProductCard({ product }) {
  const { shop } = useShop();
  const { addItem, clear, setOpen } = useCart();
  const navigate = useNavigate();
  const price = product.sale_price ?? product.price;
  const hasSale = product.sale_price != null && product.sale_price < product.price;
  const discount = hasSale ? Math.round((1 - price / product.price) * 100) : 0;
  const metadata = product.metadata || {};
  const description = (product.description || '').replace(/\s+/g, ' ').trim();
  const isDigital = metadata.product_type === 'digital';
  const buyNow = () => {
    clear();
    addItem(product, 1, {});
    setOpen(false);
    navigate(`/${shop.username}/checkout`);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition group border border-gray-100 dark:border-gray-700 flex flex-col h-full">
      <Link to={`/${shop.username}/product/${product.id}`} className="block relative">
        <div className="aspect-[1.5/1] sm:aspect-[1.35/1] bg-gray-100 dark:bg-gray-700 overflow-hidden">
          {product.images && product.images.length > 0 ? (
            <img
              src={fullUrl(product.images[0])}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
              <FiShoppingBag className="w-12 h-12" />
            </div>
          )}
        </div>
        <span className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-red-500 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">HOT</span>
        {discount > 0 && <span className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-blue-700 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">-{discount}%</span>}
      </Link>
      <div className="p-2 sm:p-5 flex flex-col flex-1">
        {product.category_name && <p className="text-xs font-bold text-gray-900 dark:text-gray-200 uppercase tracking-wide">{product.category_name}</p>}
        <Link to={`/${shop.username}/product/${product.id}`}>
          <h3 className="font-bold text-sm sm:text-lg text-primary mt-2 line-clamp-2 group-hover:underline transition leading-tight">{product.name}</h3>
        </Link>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 min-h-[32px] sm:min-h-[40px]">{description || (isDigital ? 'Digital access delivered after payment.' : 'Quality product from our store.')}</p>
        <p className="text-[11px] sm:text-xs text-amber-600 mt-2 sm:mt-3">★ {metadata.rating || '4.9'} {metadata.review_count ? `(${metadata.review_count})` : ''}</p>
        <div className="mt-2 sm:mt-3 flex flex-wrap items-baseline gap-1 sm:gap-2">
          <span className="text-lg sm:text-2xl font-bold text-blue-700 dark:text-blue-400">${price.toFixed(2)}</span>
          <span className="text-xs text-gray-500">{shop.currency}</span>
          {hasSale && <span className="text-sm text-gray-400 line-through">${Number(product.price).toFixed(2)}</span>}
        </div>
        <div className="flex items-center justify-between gap-1 mt-2 sm:mt-3 mb-3 sm:mb-4">
          <span className={`text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full ${product.quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {product.quantity > 0 ? '✓ In Stock' : 'Sold Out'}
          </span>
          <span className="text-[10px] sm:text-xs font-semibold bg-green-50 text-gray-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">{isDigital ? 'Instant' : 'Available'}</span>
        </div>
        <button onClick={buyNow} disabled={product.quantity <= 0} className="mt-auto w-full rounded-lg bg-blue-700 py-2 sm:py-3.5 text-xs sm:text-base text-white font-bold hover:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-1 sm:gap-2">
          <FiZap className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> {product.quantity > 0 ? 'Buy Now' : 'Sold Out'}
        </button>
      </div>
    </div>
  );
}
