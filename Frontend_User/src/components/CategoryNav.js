import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useShop } from '../contexts/ShopContext';
import { useLanguage } from '../i18n';

/**
 * Category chips in a SINGLE horizontal row that the user scrolls left/right.
 * The strip is sticky below the navbar so categories stay visible while the
 * user scrolls down the page.
 */
export default function CategoryNav({ categories, products = [] }) {
  const { shop } = useShop();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const active = params.get('category');

  const select = (id) => {
    const base = `/${shop.username}/products`;
    if (id) navigate(`${base}?category=${id}`);
    else navigate(base);
  };

  if (!categories || categories.length === 0) return null;

  const chip = (isActive) =>
    `store-category-pill glass-action ${isActive ? 'store-category-pill-active' : ''}`;
  const countFor = (category) => (
    typeof category.product_count === 'number'
      ? category.product_count
      : products.filter((product) => String(product.category_id) === String(category.id)).length
  );

  const isKaidoStore = shop.username?.toLowerCase() === 'kaidostore';

  return (
    <div className="store-category-nav sticky z-30 w-full" style={isKaidoStore ? { position: 'static', background: 'transparent', border: 0 } : undefined}>
      <div className="max-w-7xl mx-auto store-category-nav-inner">
        <div className="store-category-track no-scrollbar" aria-label="Product categories">
          <button type="button" className={chip(true)} aria-current="page">
            {t('all')}
            <span className="store-category-count">{products.length || categories.reduce((total, category) => total + (category.product_count || 0), 0)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
