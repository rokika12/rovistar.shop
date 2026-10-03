import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiBookmark, FiChevronDown, FiCreditCard, FiFileText, FiGlobe, FiLogOut, FiPackage, FiUser, FiX,
} from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { useCustomer } from '../contexts/CustomerContext';
import { useOwner } from '../contexts/OwnerContext';
import CustomerAuth from './CustomerAuth';
import ShopLogo from './ShopLogo';
import { DASHBOARD_URL, getMyWallet, ownerCheck, ownerDashboardUrl } from '../api';
import { useLanguage } from '../i18n';

export default function ShopHeader() {
  const { shop } = useShop();
  const { customer, isLoggedIn, logout, updateCustomer } = useCustomer();
  const { owner, token, isLoggedIn: isOwnerLoggedIn, logout: ownerLogout } = useOwner();
  const [accountOpen, setAccountOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [fullLoginOpen, setFullLoginOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(customer?.wallet_balance || 0);
  const [isMyShop, setIsMyShop] = useState(false);
  const accountMenuRef = useRef(null);
  const languageMenuRef = useRef(null);
  const navigate = useNavigate();
  const { lang, setLang, toggle: toggleLanguage, languageNames, t } = useLanguage();
  const base = `/${shop.username}`;
  const isAccountTemplate = shop.template_type === 'account';
  const isKaidoStore = shop.username?.toLowerCase() === 'kaidostore';
  const isRovistarStore = shop.username?.toLowerCase() === 'rovistar';
  const displayName = customer?.first_name || customer?.name?.split(' ')[0] || 'Account';
  const customerInitial = (displayName || 'A')[0].toUpperCase();
  const customerAvatar = customer?.avatar_url;

  useEffect(() => {
    if (!isAccountTemplate || !isLoggedIn || customer?.shop_id !== shop.id) return;
    getMyWallet(localStorage.getItem('ms_customer_token'))
      .then((wallet) => {
        const balance = Number(wallet.balance || 0);
        setWalletBalance(balance);
        updateCustomer({ wallet_balance: balance });
      })
      .catch(() => setWalletBalance(customer?.wallet_balance || 0));
  }, [shop.id, isAccountTemplate, isLoggedIn, customer?.shop_id, customer?.wallet_balance, updateCustomer]);

  useEffect(() => {
    if (isOwnerLoggedIn && token && shop?.id) {
      ownerCheck(shop.id, token)
        .then((result) => setIsMyShop(!!result.is_owner))
        .catch(() => setIsMyShop(owner?.shop_id === shop.id));
    } else {
      setIsMyShop(false);
    }
  }, [isOwnerLoggedIn, token, shop?.id, owner?.shop_id]);

  useEffect(() => {
    if (!accountOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    const closeOnOutsideClick = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setAccountOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('mousedown', closeOnOutsideClick);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!languageOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setLanguageOpen(false);
    };
    const closeOnOutsideClick = (event) => {
      if (!languageMenuRef.current?.contains(event.target)) setLanguageOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('mousedown', closeOnOutsideClick);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [languageOpen]);

  const closePanels = () => {
    setAccountOpen(false);
  };

  const finishFullLogin = () => {
    setFullLoginOpen(false);
    navigate(`${base}/products`);
  };

  const openOwnerDashboard = (result) => {
    if (result?.user?.shop_id !== shop.id) return;
    window.location.assign(ownerDashboardUrl(result.access_token, result.user));
  };

  return (
    <header className={`store-header ${isKaidoStore ? 'kaido-store-header' : ''}`}>
      <div className="store-header-inner">
        <Link to={base} onClick={closePanels} className={`store-brand ${isKaidoStore ? 'store-brand-kaido' : ''}`} aria-label={`${shop.shop_name || shop.username} home`}>
          <ShopLogo shop={shop} className="h-10 w-10 rounded-2xl" textClassName="hidden" />
          <span className="store-brand-copy">
            <strong>{isKaidoStore ? 'kaidostore' : (shop.shop_name || shop.username)}</strong>
            <small>{isKaidoStore ? 'Verified game accounts' : t('marketplaceSubtitle')}</small>
          </span>
        </Link>
        <div className="store-header-actions">
          <div className="store-utility-switcher" aria-label="Language and theme controls">
            {isRovistarStore ? (
              <div className="store-language-menu-wrap" ref={languageMenuRef}>
                <button type="button" onClick={() => setLanguageOpen(!languageOpen)} className="store-language-toggle" aria-expanded={languageOpen} aria-haspopup="menu" aria-label="Choose language"><FiGlobe /><span>{languageNames[lang]}</span><FiChevronDown className={languageOpen ? 'store-language-chevron-open' : ''} /></button>
                {languageOpen && <div className="store-language-menu" role="menu" aria-label="Choose language">
                  {['kh', 'en', 'zh'].map((code) => <button key={code} type="button" role="menuitemradio" aria-checked={lang === code} className={lang === code ? 'store-language-option is-active' : 'store-language-option'} onClick={() => { setLang(code); setLanguageOpen(false); }}><span>{languageNames[code]}</span>{lang === code && <span className="store-language-check">✓</span>}</button>)}
                </div>}
              </div>
            ) : <button type="button" onClick={toggleLanguage} className="store-language-toggle" aria-label="Switch language"><FiGlobe /><span>{lang === 'kh' ? 'ខ្មែរ' : (lang === 'zh' ? '中文' : 'EN')}</span></button>}
            {isRovistarStore && <Link to={`${base}/information`} className="store-information-toggle"><FiFileText /><span>{t('importantInformation')}</span></Link>}
          </div>
          <div className="store-account-menu-wrap" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => {
                if (!isLoggedIn) {
                  setFullLoginOpen(true);
                  return;
                }
                setAccountOpen(!accountOpen);
              }}
              className={`store-account-trigger store-account-avatar-trigger ${accountOpen ? 'store-account-trigger-open' : ''}`}
              aria-expanded={accountOpen}
              aria-label={isLoggedIn ? `${displayName} account` : 'Open account'}
            >
              <span className="store-avatar">{isLoggedIn ? (customerAvatar ? <img src={customerAvatar} alt="Your account" /> : customerInitial) : <FiUser />}</span>
            </button>

            {accountOpen && (
              <div className="store-account-menu" role="dialog" aria-label="Account menu">
                {isLoggedIn ? (
                  <>
                    <div className="store-account-menu-profile store-account-menu-identity">
                      <span className="store-profile-avatar customer-profile-avatar">{customerAvatar ? <img src={customerAvatar} alt="Your account" /> : customerInitial}</span>
                      <div><strong>{customer?.email || customer?.name || customer?.username}</strong><small><FiCreditCard /> ${Number(walletBalance).toFixed(2)}</small></div>
                      <button type="button" onClick={() => setAccountOpen(false)} aria-label="Close account menu"><FiX /></button>
                    </div>
                    <div className="store-account-menu-links">
                      <Link to={`${base}/my-orders`} onClick={closePanels}><FiPackage /> Order history</Link>
                      {isAccountTemplate && <Link to={`${base}/profile#top-up`} onClick={closePanels}><FiCreditCard /> Top Up</Link>}
                      <Link to={`${base}/profile`} onClick={closePanels}><FiUser /> Account</Link>
                      {isRovistarStore && <Link to={`${base}/saved-information`} onClick={closePanels}><FiBookmark /> ព័ត៌មានដែលបានរក្សាទុក</Link>}
                      {isMyShop && <a href={DASHBOARD_URL} target="_blank" rel="noreferrer">Dashboard</a>}
                    </div>
                    <div className="store-account-menu-footer">
                      <button type="button" onClick={() => { logout(); setAccountOpen(false); }}><FiLogOut /> Log out</button>
                      {isMyShop && <button type="button" onClick={ownerLogout} className="store-owner-signout">Sign out of dashboard</button>}
                    </div>
                  </>
                ) : (
                  <div className="store-account-login">
                    <div className="store-account-login-heading"><div><span>WELCOME</span><h2>Sign in</h2></div><button type="button" onClick={() => setAccountOpen(false)} aria-label="Close account menu"><FiX /></button></div>
                    <p>Sign in to keep your orders and payment records in one place.</p>
                    <CustomerAuth onSuccess={() => setAccountOpen(false)} onOwnerSuccess={openOwnerDashboard} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {fullLoginOpen && createPortal(
        <div className="store-full-login" role="dialog" aria-modal="true" aria-label="Sign in">
          <div className="store-full-login-panel">
            <div className="store-full-login-intro">
              <ShopLogo shop={shop} className="h-14 w-14 rounded-2xl" textClassName="hidden" />
              <p>WELCOME TO</p>
              <h1>{shop.shop_name || shop.username}</h1>
              <span>Sign in once to keep your orders, payment records, and account details together.</span>
            </div>
            <section className="store-full-login-card">
              <button type="button" onClick={() => setFullLoginOpen(false)} className="store-full-login-close" aria-label="Close sign in"><FiX /></button>
              <h2>Sign in to your account</h2>
              <p>Use your Rovistar account details to continue.</p>
              <CustomerAuth onSuccess={finishFullLogin} onOwnerSuccess={openOwnerDashboard} />
            </section>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
