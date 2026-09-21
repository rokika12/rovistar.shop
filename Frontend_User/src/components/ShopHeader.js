import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  FiChevronRight, FiCreditCard, FiGrid, FiHome, FiLogOut, FiMenu,
  FiPackage, FiSearch, FiShoppingBag, FiUser, FiX,
} from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { useCustomer } from '../contexts/CustomerContext';
import { useOwner } from '../contexts/OwnerContext';
import { useLanguage } from '../i18n';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import CustomerAuth from './CustomerAuth';
import ShopLogo from './ShopLogo';
import { DASHBOARD_URL, getMyWallet, ownerCheck } from '../api';

export default function ShopHeader() {
  const { shop } = useShop();
  const { customer, isLoggedIn, logout } = useCustomer();
  const { owner, token, isLoggedIn: isOwnerLoggedIn, logout: ownerLogout } = useOwner();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(customer?.wallet_balance || 0);
  const [isMyShop, setIsMyShop] = useState(false);
  const base = `/${shop.username}`;
  const isAccountTemplate = shop.template_type === 'account';
  const displayName = customer?.first_name || customer?.name?.split(' ')[0] || t('signIn');
  const initial = (customer?.name || customer?.username || 'R')[0].toUpperCase();

  useEffect(() => {
    if (!isAccountTemplate || !isLoggedIn || customer?.shop_id !== shop.id) return;
    getMyWallet(localStorage.getItem('ms_customer_token'))
      .then((wallet) => setWalletBalance(wallet.balance || 0))
      .catch(() => setWalletBalance(customer?.wallet_balance || 0));
  }, [shop.id, isAccountTemplate, isLoggedIn, customer?.shop_id, customer?.wallet_balance]);

  useEffect(() => {
    if (isOwnerLoggedIn && token && shop?.id) {
      ownerCheck(shop.id, token)
        .then((result) => setIsMyShop(!!result.is_owner))
        .catch(() => setIsMyShop(owner?.shop_id === shop.id));
    } else {
      setIsMyShop(false);
    }
  }, [isOwnerLoggedIn, token, shop?.id, owner?.shop_id]);

  const closePanels = () => {
    setMenuOpen(false);
    setAccountOpen(false);
  };

  const navClass = ({ isActive }) =>
    `store-nav-link ${isActive ? 'store-nav-link-active' : ''}`;

  return (
    <header className="store-header sticky top-0 z-40">
      <div className="store-header-inner">
        <Link to={base} onClick={closePanels} className="store-brand" aria-label={`${shop.shop_name || shop.username} home`}>
          <ShopLogo shop={shop} className="h-10 w-10 rounded-2xl" textClassName="hidden" />
          <span className="store-brand-copy">
            <strong>{shop.shop_name || shop.username}</strong>
            <small>Rovistar marketplace</small>
          </span>
        </Link>

        <nav className="store-desktop-nav" aria-label="Shop navigation">
          <NavLink to={base} end className={navClass}>{t('home')}</NavLink>
          <NavLink to={`${base}/products`} className={navClass}>{t('products')}</NavLink>
          <NavLink to={`${base}/my-orders`} className={navClass}>{t('myOrders')}</NavLink>
        </nav>

        <div className="store-header-actions">
          <Link to={`${base}/products`} className="store-icon-action" aria-label={t('searchPlaceholder')} title={t('searchPlaceholder')}>
            <FiSearch />
          </Link>
          {isAccountTemplate && isLoggedIn && customer?.shop_id === shop.id && (
            <Link to={`${base}/profile`} className="store-wallet" title="Open wallet">
              <FiCreditCard /> <span>${Number(walletBalance).toFixed(2)}</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => { setAccountOpen(!accountOpen); setMenuOpen(false); }}
            className={`store-account-trigger ${accountOpen ? 'store-account-trigger-open' : ''}`}
            aria-expanded={accountOpen}
            aria-label={isLoggedIn ? `${displayName} account` : t('signIn')}
          >
            <span className="store-avatar">{isLoggedIn ? initial : <FiUser />}</span>
            <span className="store-account-name">{displayName}</span>
          </button>
          <button
            type="button"
            onClick={() => { setMenuOpen(!menuOpen); setAccountOpen(false); }}
            className="store-menu-trigger"
            aria-expanded={menuOpen}
            aria-label="Open menu"
          >
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="store-mobile-menu">
          <NavLink to={base} end onClick={closePanels} className={navClass}><FiHome /> {t('home')}</NavLink>
          <NavLink to={`${base}/products`} onClick={closePanels} className={navClass}><FiShoppingBag /> {t('products')}</NavLink>
          <NavLink to={`${base}/my-orders`} onClick={closePanels} className={navClass}><FiPackage /> {t('myOrders')}</NavLink>
          <NavLink to={`${base}/about`} onClick={closePanels} className={navClass}><FiGrid /> {t('about')}</NavLink>
        </div>
      )}

      {accountOpen && (
        <div className="store-account-layer" onClick={() => setAccountOpen(false)}>
          <aside className="store-account-drawer" onClick={(event) => event.stopPropagation()} aria-label="Account panel">
            <div className="store-drawer-heading">
              <div>
                <span className="store-drawer-kicker">ROVISTAR ACCOUNT</span>
                <h2>{isLoggedIn ? `សួស្តី ${displayName}` : 'ចូលគណនីរបស់អ្នក'}</h2>
              </div>
              <button type="button" onClick={() => setAccountOpen(false)} className="store-icon-action" aria-label="Close account panel"><FiX /></button>
            </div>

            {isLoggedIn ? (
              <div className="store-drawer-content">
                <div className="store-profile-summary">
                  <span className="store-profile-avatar">{initial}</span>
                  <div>
                    <strong>{customer?.name || customer?.username}</strong>
                    <p>{customer?.email || customer?.phone || 'Rovistar customer'}</p>
                  </div>
                </div>
                <div className="store-drawer-links">
                  <Link to={`${base}/profile`} onClick={closePanels}><FiUser /> <span>{t('myProfile')}</span><FiChevronRight /></Link>
                  <Link to={`${base}/my-orders`} onClick={closePanels}><FiPackage /> <span>{t('myOrders')}</span><FiChevronRight /></Link>
                  {isAccountTemplate && customer?.shop_id === shop.id && (
                    <Link to={`${base}/profile`} onClick={closePanels}><FiCreditCard /> <span>Wallet · ${Number(walletBalance).toFixed(2)}</span><FiChevronRight /></Link>
                  )}
                  {isMyShop && (
                    <a href={DASHBOARD_URL} target="_blank" rel="noreferrer"><FiGrid /> <span>{t('dashboard')}</span><FiChevronRight /></a>
                  )}
                </div>
                <div className="store-drawer-preferences">
                  <div><span>Appearance</span><ThemeToggle /></div>
                  <div><span>Language</span><LanguageSwitcher /></div>
                </div>
                <button type="button" onClick={() => { logout(); setAccountOpen(false); }} className="store-signout"><FiLogOut /> {t('logOut')}</button>
                {isMyShop && <button type="button" onClick={ownerLogout} className="store-owner-signout">Sign out of dashboard</button>}
              </div>
            ) : (
              <div className="store-drawer-content">
                <p className="store-drawer-note">Create an account with your email or phone to keep orders, receipts, and payment history in one place.</p>
                <CustomerAuth onSuccess={() => setAccountOpen(false)} />
                <div className="store-drawer-preferences">
                  <div><span>Appearance</span><ThemeToggle /></div>
                  <div><span>Language</span><LanguageSwitcher /></div>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </header>
  );
}
