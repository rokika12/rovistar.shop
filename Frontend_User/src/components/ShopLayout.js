import React from 'react';
import { Outlet } from 'react-router-dom';
import { FiSend, FiShoppingBag } from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { useLanguage } from '../i18n';
import ShopHeader from './ShopHeader';
import ShopFooter from './ShopFooter';
import CartSidebar from './CartSidebar';
import ShopSkeleton from './ShopSkeleton';

export default function ShopLayout() {
  const { shop, loading, error } = useShop();
  const { t } = useLanguage();

  if (loading) {
    return <ShopSkeleton />;
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 text-center">
        <FiShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800">{t('shopUnavailable')}</h1>
        <p className="text-gray-500 mt-2">{error || t('shopNotFoundMsg')}</p>
        <a href="/" className="btn-primary mt-6 px-6 py-2 rounded-lg">{t('backHome')}</a>
      </div>
    );
  }

  // Contact this shop owner: the shop's own Telegram link, else the platform channel.
  const tgContact = shop.social_media?.telegram
    || (typeof shop.contact === 'string' && shop.contact.includes('t.me') ? shop.contact : '')
    || '';
  const theme = shop.theme || {};
  const isAccountTemplate = shop.template_type === 'account';
  const themeStyle = {
    '--primary': theme.primary || '#123B3A',
    '--secondary': theme.secondary || '#F4C95D',
    '--brand-blue': theme.primary || '#123B3A',
    '--brand-pink': theme.secondary || '#F4C95D',
    fontFamily: theme.font_family ? `'${theme.font_family}', 'Kantumruy Pro', sans-serif` : undefined,
  };

  return (
    <div className="min-h-screen flex flex-col dark:bg-gray-900" data-template={shop.template_type || 'login'} style={themeStyle}>
      <div className="store-sticky-shell">
        <div className="brand-ticker bg-[var(--brand-blue)] text-white" aria-label="Store security notice">
          <div className="brand-ticker-track">
            <span>{isAccountTemplate
              ? 'SECURE CHECKOUT · VERIFIED PAYMENTS · DIGITAL SERVICE SUPPORT · '
              : 'SECURE CHECKOUT · VERIFIED PAYMENTS · FAST CUSTOMER SUPPORT · '}</span>
            <span aria-hidden="true">{isAccountTemplate
              ? 'SECURE CHECKOUT · VERIFIED PAYMENTS · DIGITAL SERVICE SUPPORT'
              : 'SECURE CHECKOUT · VERIFIED PAYMENTS · FAST CUSTOMER SUPPORT'}</span>
          </div>
        </div>
        <ShopHeader />
      </div>
      <main className="storefront-main flex-1">
        <Outlet />
      </main>
      <ShopFooter />
      {!isAccountTemplate && <CartSidebar />}

      {/* Keep one compact support action without duplicating mobile navigation. */}
      {tgContact && (
        <a
          href={tgContact}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] md:bottom-6 right-3 z-[60] inline-flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1d8cc1] text-white font-bold text-xs md:text-sm p-3 sm:px-4 sm:py-3 rounded-full shadow-xl transition"
        >
          <FiSend className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">{t('contactThisOwner')}</span>
        </a>
      )}
    </div>
  );
}
