import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  FiChevronDown, FiCreditCard, FiGrid, FiHome, FiLogOut, FiMenu,
  FiPackage, FiPlusCircle, FiSearch, FiShoppingBag, FiUser, FiX,
} from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { useCustomer } from '../contexts/CustomerContext';
import { useOwner } from '../contexts/OwnerContext';
import CustomerAuth from './CustomerAuth';
import ShopLogo from './ShopLogo';
import { DASHBOARD_URL, getMyWallet, ownerCheck } from '../api';

export default function ShopHeader() {
  const { shop } = useShop();
  const { customer, isLoggedIn, logout } = useCustomer();
  const { owner, token, isLoggedIn: isOwnerLoggedIn, logout: ownerLogout } = useOwner();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(customer?.wallet_balance || 0);
  const [isMyShop, setIsMyShop] = useState(false);
  const accountMenuRef = useRef(null);
  const base = `/${shop.username}`;
  const isAccountTemplate = shop.template_type === 'account';
  const displayName = customer?.first_name || customer?.name?.split(' ')[0] || 'Account';
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

  const closePanels = () => {
    setMenuOpen(false);
    setAccountOpen(false);
  };

  const navClass = ({ isActive }) => `store-nav-link ${isActive ? 'store-nav-link-active' : ''}`;

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
          <NavLink to={base} end className={navClass}>Home</NavLink>
          <NavLink to={`${base}/products`} className={navClass}>Products</NavLink>
          <NavLink to={`${base}/my-orders`} className={navClass}>My orders</NavLink>
        </nav>

        <div className="store-header-actions">
          <Link to={`${base}/products`} className="store-icon-action" aria-label="Search products" title="Search products"><FiSearch /></Link>
          {isAccountTemplate && isLoggedIn && customer?.shop_id === shop.id && (
            <Link to={`${base}/profile`} className="store-wallet" title="Open wallet"><FiCreditCard /> <span>Wallet</span><b>${Number(walletBalance).toFixed(2)}</b></Link>
          )}
          <div className="store-account-menu-wrap" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => { setAccountOpen(!accountOpen); setMenuOpen(false); }}
              className={`store-account-trigger ${accountOpen ? 'store-account-trigger-open' : ''}`}
              aria-expanded={accountOpen}
              aria-label={isLoggedIn ? `${displayName} account` : 'Open account'}
            >
              <span className="store-avatar">{isLoggedIn ? initial : <FiUser />}</span>
              <span className="store-account-name">{displayName}</span>
              <FiChevronDown className={`store-account-chevron ${accountOpen ? 'store-account-chevron-open' : ''}`} />
            </button>

            {accountOpen && (
              <div className="store-account-menu" role="dialog" aria-label="Account menu">
                {isLoggedIn ? (
                  <>
                    <div className="store-account-menu-profile">
                      <span className="store-profile-avatar">{initial}</span>
                      <div><strong>{customer?.name || customer?.username}</strong><small>{customer?.email || customer?.phone || 'Rovistar customer'}</small></div>
                      <button type="button" onClick={() => setAccountOpen(false)} aria-label="Close account menu"><FiX /></button>
                    </div>
                    <div className="store-account-menu-links">
                      <Link to={`${base}/products`} onClick={closePanels}><FiShoppingBag /> Browse products</Link>
                      <Link to={`${base}/my-orders`} onClick={closePanels}><FiPackage /> Order history</Link>
                      <Link to={`${base}/profile`} onClick={closePanels}><FiUser /> Account</Link>
                      {isAccountTemplate && customer?.shop_id === shop.id && <Link to={`${base}/profile`} onClick={closePanels}><FiPlusCircle /> Add balance</Link>}
                      {isMyShop && <a href={DASHBOARD_URL} target="_blank" rel="noreferrer"><FiGrid /> Dashboard</a>}
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
                    <CustomerAuth onSuccess={() => setAccountOpen(false)} />
                  </div>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={() => { setMenuOpen(!menuOpen); setAccountOpen(false); }} className="store-menu-trigger" aria-expanded={menuOpen} aria-label="Open menu">
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="store-mobile-menu">
          <NavLink to={base} end onClick={closePanels} className={navClass}><FiHome /> Home</NavLink>
          <NavLink to={`${base}/products`} onClick={closePanels} className={navClass}><FiShoppingBag /> Products</NavLink>
          <NavLink to={`${base}/my-orders`} onClick={closePanels} className={navClass}><FiPackage /> My orders</NavLink>
          <NavLink to={`${base}/about`} onClick={closePanels} className={navClass}><FiGrid /> About</NavLink>
        </div>
      )}
    </header>
  );
}
