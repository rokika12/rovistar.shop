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
    `store-category-pill ${isActive ? 'store-category-pill-active' : ''}`;
  const countFor = (category) => (
    typeof category.product_count === 'number'
      ? category.product_count
      : products.filter((product) => String(product.category_id) === String(category.id)).length
  );

  return (
    <div className="store-category-nav sticky z-30 w-full">
      <div className="max-w-7xl mx-auto store-category-nav-inner">
        <div className="store-category-track no-scrollbar" aria-label="Product categories">
          <button onClick={() => select(null)} className={chip(!active)} aria-current={!active ? 'page' : undefined}>
            {t('all')}
            <span className="store-category-count">{products.length || categories.reduce((total, category) => total + (category.product_count || 0), 0)}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => select(c.id)}
              className={chip(String(active) === String(c.id))}
              aria-current={String(active) === String(c.id) ? 'page' : undefined}
            >
              {c.name}
              <span className="store-category-count">{countFor(c)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
