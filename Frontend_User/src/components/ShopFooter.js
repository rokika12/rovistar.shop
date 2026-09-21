import React from 'react';
import { Link } from 'react-router-dom';
import { FiCreditCard } from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { useLanguage } from '../i18n';
import SocialLinks from './SocialLinks';
import ShopLogo from './ShopLogo';

export default function ShopFooter() {
  const { shop } = useShop();
  const { t } = useLanguage();
  const base = `/${shop.username}`;
  return (
    <footer className="bg-slate-50 text-slate-600 border-t-4 border-blue-950 pb-24 md:pb-0">
      <div className="w-full border-b border-blue-100">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShopLogo shop={shop} className="w-8 h-8 rounded-full" textClassName="text-sm" />
              <span className="shop-brand-name text-blue-950 text-lg">{shop.shop_name || shop.username}</span>
            </div>
            <p className="text-sm text-slate-500 line-clamp-3">{shop.bio || shop.description}</p>
            <div className="mt-4">
              <SocialLinks />
            </div>
          </div>
          <div>
            <h4 className="shop-brand-heading text-blue-700 mb-3">{t('quickLinks')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to={base} className="hover:text-[var(--primary)]">{t('home')}</Link></li>
              <li><Link to={`${base}/products`} className="hover:text-[var(--primary)]">{t('products')}</Link></li>
              <li><Link to={`${base}/about`} className="hover:text-[var(--primary)]">{t('about')}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="shop-brand-heading text-blue-700 mb-3">{t('contact')}</h4>
            <p className="text-sm text-slate-500 whitespace-pre-line">{shop.contact || '—'}</p>
            <p className="text-xs text-slate-400 mt-4">{t('poweredBy')}</p>
          </div>
        </div>

        {/* Payment methods accepted */}
        <div className="mt-10 pt-6 border-t border-blue-100 flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm text-slate-500">{t('weAccept')}:</span>
          <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm">
            <FiCreditCard className="w-3.5 h-3.5" /> ABA Pay
          </span>
          <span className="inline-flex items-center gap-1.5 bg-[var(--primary)] text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm">
            KHQR
          </span>
        </div>
      </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <span>{shop.shop_name || shop.username} · {t('poweredBy')}</span>
        <span>© {new Date().getFullYear()} · All rights reserved</span>
      </div>
    </footer>
  );
}
