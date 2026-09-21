import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowUpRight, FiShoppingBag, FiZap } from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { useCart } from '../contexts/CartContext';
import { fullUrl } from '../api';

export default function ProductCard({ product }) {
  const { shop } = useShop();
  const { addItem, clear, setOpen } = useCart();
  const navigate = useNavigate();
  const [imageFailed, setImageFailed] = useState(false);
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
    <article className="store-product-card bg-white dark:bg-gray-800 overflow-hidden transition group flex flex-col h-full">
      <Link to={`/${shop.username}/product/${product.id}`} className="block relative">
        <div className="aspect-[1.35/1] bg-slate-100 dark:bg-gray-700 overflow-hidden">
          {product.images?.[0] && !imageFailed ? (
            <img
              src={fullUrl(product.images[0])}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-50 to-slate-100 text-blue-500">
              <FiShoppingBag className="w-10 h-10" />
              <span className="text-[10px] font-black uppercase tracking-[0.12em]">Rovistar pick</span>
            </div>
          )}
        </div>
        {hasSale && <span className="absolute top-3 right-3 bg-rose-500 text-white text-[10px] font-black px-2.5 py-1.5 rounded-full">-{discount}%</span>}
        {metadata.featured && <span className="absolute top-3 left-3 bg-white/90 text-blue-700 text-[10px] font-black px-2.5 py-1.5 rounded-full backdrop-blur">HOT</span>}
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
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-xl sm:text-2xl font-black text-blue-700">${Number(price).toFixed(2)}</span>
          <span className="text-[10px] font-bold text-slate-400">{shop.currency}</span>
          {hasSale && <span className="text-xs text-slate-400 line-through">${Number(product.price).toFixed(2)}</span>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-bold">
          <span className={product.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}>{product.quantity > 0 ? '● Available' : '● Sold out'}</span>
          <span className="text-slate-400">{isDigital ? 'Instant access' : 'Ready to order'}</span>
        </div>
        <button onClick={buyNow} disabled={product.quantity <= 0} className="mt-4 w-full rounded-xl bg-blue-700 py-2.5 text-xs sm:text-sm text-white font-black hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition">
          <FiZap className="w-4 h-4" /> {product.quantity > 0 ? 'Buy now' : 'Sold out'}
        </button>
      </div>
    </article>
  );
}
