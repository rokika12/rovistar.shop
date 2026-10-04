import React from 'react';
import { Link } from 'react-router-dom';
import { FiShield } from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { useLanguage } from '../i18n';
import SocialLinks from './SocialLinks';
import ShopLogo from './ShopLogo';

export default function ShopFooter() {
  const { shop } = useShop();
  const { t } = useLanguage();
  const base = `/${shop.username}`;
  return (
    <footer className="shop-footer bg-white text-slate-600 border-t border-slate-200 pb-24 md:pb-0">
      <div className="max-w-7xl mx-auto px-5 py-12 md:py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.5fr_1fr_1fr] md:gap-16">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <ShopLogo shop={shop} className="w-8 h-8 rounded-full" textClassName="text-sm" />
              <span className="shop-brand-name text-blue-950 text-lg">{shop.shop_name || shop.username}</span>
            </div>
            <p className="text-sm leading-6 text-slate-500">{shop.bio || shop.description || 'Your trusted destination for fast, secure, and reliable service.'}</p>
            <div className="mt-4">
              <SocialLinks />
            </div>
          </div>
          <div>
            <h4 className="shop-brand-heading text-slate-900 mb-4">{t('quickLinks')}</h4>
            <ul className="space-y-3 text-sm text-slate-500">
              <li><Link to={base} className="hover:text-[var(--primary)]">{t('home')}</Link></li>
              <li><Link to={`${base}/products`} className="hover:text-[var(--primary)]">{t('products')}</Link></li>
              <li><Link to={`${base}/about`} className="hover:text-[var(--primary)]">{t('about')}</Link></li>
            </ul>
          </div>
          <div className="space-y-8">
            <div>
              <div className="shop-payment-acceptance" aria-label={t('weAccept')}>
                <h4 className="shop-brand-heading text-slate-900">{t('weAccept')}</h4>
                <div className="shop-payment-brand-row">
                  <img src={`${process.env.PUBLIC_URL}/aba-brand.png`} alt="ABA" />
                  <img src={`${process.env.PUBLIC_URL}/khqr-brand.webp`} alt="KHQR" />
                </div>
              </div>
            </div>
            <div>
              <h4 className="shop-brand-heading text-slate-900 mb-3">{t('contact')}</h4>
              <p className="text-sm leading-6 text-slate-500 whitespace-pre-line">{shop.contact || '—'}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <span>© {new Date().getFullYear()} {shop.shop_name || shop.username}. All rights reserved.</span>
        <span className="inline-flex items-center gap-1.5"><FiShield className="text-blue-600" /> Secure payments · Reliable service · 24/7 support</span>
      </div>
      </div>
    </footer>
  );
}
