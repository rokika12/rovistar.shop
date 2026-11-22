import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight, FiHeart, FiMapPin, FiPackage, FiSearch, FiShoppingBag,
  FiShoppingCart, FiSliders, FiTruck, FiX,
} from 'react-icons/fi';
import { useCart } from '../contexts/CartContext';

export default function CommerceToolbox({
  shop,
  categories,
  products,
  query,
  setQuery,
  selectedCategory,
  setSelectedCategory,
  sort,
  setSort,
  inStockOnly,
  setInStockOnly,
}) {
  const { totals, setOpen } = useCart();
  const base = `/${shop.username}`;
  const activeCategory = categories.find((category) => String(category.id) === String(selectedCategory));

  return (
    <section className="commerce-toolbox" aria-label="Shopping tools">
      <div className="commerce-toolbox-topline">
        <p><span>SHOP SMARTER</span> Everything you need, one storefront.</p>
        <div className="commerce-toolbox-shortcuts">
          <Link to={`${base}/my-orders`}><FiPackage /> Orders</Link>
          <Link to={`${base}/profile`}><FiHeart /> Saved</Link>
          <button type="button" onClick={() => setOpen(true)}><FiShoppingCart /> Cart <b>{totals.count}</b></button>
        </div>
      </div>

      <div className="commerce-toolbox-grid">
        <div className="commerce-toolbox-search">
          <FiSearch />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products, collections, or brands"
            aria-label="Search catalog"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><FiX /></button>}
        </div>

        <label className="commerce-toolbox-sort">
          <FiSliders />
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
          </select>
        </label>

        <label className="commerce-stock-toggle">
          <input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} />
          <span>In stock only</span>
        </label>
      </div>

      <div className="commerce-toolbox-categories">
        <button
          type="button"
          className={!selectedCategory ? 'is-active' : ''}
          onClick={() => setSelectedCategory('')}
        >
          All products <b>{products.length}</b>
        </button>
        {categories.map((category) => {
          const count = products.filter((product) => String(product.category_id) === String(category.id)).length;
          if (!count) return null;
          return (
            <button
              key={category.id}
              type="button"
              className={String(selectedCategory) === String(category.id) ? 'is-active' : ''}
              onClick={() => setSelectedCategory(String(category.id))}
            >
              {category.name} <b>{count}</b>
            </button>
          );
        })}
      </div>

      <div className="commerce-toolbox-status">
        <span><FiShoppingBag /> {activeCategory ? activeCategory.name : 'Catalog'} <b>{products.length} items ready to browse</b></span>
        <span><FiTruck /> Secure payment and delivery options at checkout</span>
        <Link to={`${base}/products`}>Open full catalog <FiArrowRight /></Link>
      </div>
    </section>
  );
}
