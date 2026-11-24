import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCalendar, FiCheckCircle, FiCreditCard, FiDollarSign, FiEdit2, FiEye, FiEyeOff, FiKey, FiList, FiLogOut, FiPlus, FiSave, FiShield, FiUser, FiX } from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { useCustomer } from '../contexts/CustomerContext';
import { useLanguage } from '../i18n';
import { fullUrl, getMyOrders, getMyWallet, topUpWallet, updateMyProfile, changeMyPassword, uploadMyAvatar, verifyPayment } from '../api';
import CustomerAuth from '../components/CustomerAuth';

const TOPUP_OPTIONS = [5, 10, 20, 50, 100];

export default function Profile() {
  const { shop } = useShop();
  const { customer, token, isLoggedIn, logout, setSession, updateCustomer } = useCustomer();
  const { t } = useLanguage();
  const [ordersCount, setOrdersCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: '', username: '', gender: '', email: '', phone: '',
    telegram_username: '', telegram_phone: '', address: '', city: '', country: '',
  });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [changingPw, setChangingPw] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [topupAmount, setTopupAmount] = useState('5');
  const [topup, setTopup] = useState(null);
  const [topupSuccess, setTopupSuccess] = useState(null);
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupTelegram, setTopupTelegram] = useState('');

  const completeTopup = async (payment) => {
    const updated = await getMyWallet(token);
    setWallet(updated);
    updateCustomer({ wallet_balance: Number(updated.balance || 0) });
    setTopupSuccess({ amount: Number(payment.order.total || topupAmount), reference: payment.payment?.transaction_id || payment.order.order_number, balance: Number(updated.balance || 0), paidAt: new Date() });
    setTopup(null);
    toast.success('Payment confirmed. Wallet balance updated.');
  };

  // ABA can confirm through its webhook, so keep the wallet screen live until the credit lands.
  useEffect(() => {
    if (!topup?.order?.id) return undefined;
    let cancelled = false;
    const checkPayment = async () => {
      try {
        const result = await verifyPayment({ order_id: topup.order.id, transaction_id: topup.payment?.transaction_id || '' });
        if (!cancelled && result.verified) await completeTopup(topup);
      } catch (_) { /* Payment remains pending until ABA confirms it. */ }
    };
    const firstCheck = setTimeout(checkPayment, 2500);
    const poll = setInterval(checkPayment, 3000);
    return () => { cancelled = true; clearTimeout(firstCheck); clearInterval(poll); };
  }, [topup, token]);

  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let mounted = true;
    getMyOrders(token)
      .then((res) => { if (mounted) setOrdersCount(res.count || 0); })
      .catch(() => {});
    getMyWallet(token).then((nextWallet) => {
      if (!mounted) return;
      setWallet(nextWallet);
      updateCustomer({ wallet_balance: Number(nextWallet.balance || 0) });
    }).catch(() => {});
    return () => { mounted = false; };
  }, [isLoggedIn, token, updateCustomer]);

  const startTopup = async () => {
    const amount = Number(topupAmount);
    if (!amount || amount < 0.10) { toast.error('Enter a valid top-up amount'); return; }
    if (!/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(topupTelegram.trim())) { toast.error('Enter a valid Telegram username starting with @'); return; }
    setTopupBusy(true);
    try {
      const updatedCustomer = await updateMyProfile(token, { ...profileForm, telegram_username: topupTelegram.trim() });
      setSession({ access_token: token, customer: updatedCustomer });
      const result = await topUpWallet(token, {
        amount,
        success_url: `${window.location.origin}${window.location.pathname}`,
        error_url: window.location.href,
      });
      setTopup(result);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Unable to start wallet top-up');
    } finally { setTopupBusy(false); }
  };

  const confirmTopup = async () => {
    if (!topup?.order?.id) return;
    try {
      const result = await verifyPayment({ order_id: topup.order.id, transaction_id: topup.payment?.transaction_id || '' });
      if (!result.verified) { toast.error('Payment is still pending'); return; }
      await completeTopup({ ...topup, payment: { ...topup.payment, transaction_id: result.transaction_id || topup.payment?.transaction_id } });
    } catch (err) { toast.error(err?.response?.data?.detail || 'Could not confirm top-up'); }
  };

  // Prefill the edit form from the current customer profile.
  useEffect(() => {
    if (customer) {
      setProfileForm({
        full_name: customer.name || '',
        username: customer.username || '',
        gender: customer.gender || '',
        email: customer.email || '',
        phone: customer.phone || '',
        telegram_username: customer.telegram_username || '',
        telegram_phone: customer.telegram_phone || '',
        address: customer.address || '',
        city: customer.city || '',
        country: customer.country || '',
      });
      setTopupTelegram(customer.telegram_username || customer.telegram || '');
    }
  }, [customer]);

  if (!shop) return null;

  // Not signed in → show the login / signup form.
  if (!isLoggedIn) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8 max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-sky-100 flex items-center justify-center mb-4">
              <FiUser className="w-8 h-8 text-sky-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">{t('signInRequired')}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">{t('signInRequiredDesc')}</p>
          </div>
          <CustomerAuth />
        </div>
      </div>
    );
  }

  const setProfile = (field) => (e) => setProfileForm({ ...profileForm, [field]: e.target.value });
  const setPw = (field) => (e) => setPwForm({ ...pwForm, [field]: e.target.value });

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.full_name || !profileForm.username) {
      toast.error(t('fillRequired'));
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMyProfile(token, profileForm);
      setSession({ access_token: token, customer: updated });
      setEditing(false);
      toast.success(t('profileUpdated'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    if (!pwForm.current_password || !pwForm.new_password || !pwForm.confirm_password) {
      toast.error(t('fillRequired'));
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error(t('passwordMismatch'));
      return;
    }
    setChangingPw(true);
    try {
      await changeMyPassword(token, {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success(t('passwordUpdated'));
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  const changeAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const updated = await uploadMyAvatar(file, token);
      setSession({ access_token: token, customer: updated });
      toast.success('រូបភាព Profile បានប្តូររួច');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'មិនអាចប្តូររូបភាពបានទេ');
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const base = `/${shop.username}`;
  const initial = ((customer?.name || customer?.username || 'U')[0] || 'U').toUpperCase();
  const created = customer?.created_at ? new Date(customer.created_at) : null;

  const infoRows = [
    { label: t('username'), value: customer?.username },
    { label: t('fullName'), value: customer?.name },
    { label: t('gender'), value: customer?.gender ? t(customer.gender) : '' },
    { label: t('gmail'), value: customer?.email },
    { label: t('phone'), value: customer?.phone },
    { label: t('telegram'), value: customer?.telegram || customer?.telegram_username || customer?.telegram_phone },
    { label: t('address'), value: customer?.address },
    { label: t('city'), value: customer?.city },
    { label: t('country'), value: customer?.country },
  ].filter((r) => r.value);

  const inputCls = 'mt-1 w-full border rounded-lg px-3 py-2 text-sm';
  const pwInput = (field, showKey) => (
    <div className="relative mt-1">
      <input
        type={showPw[showKey] ? 'text' : 'password'}
        value={pwForm[field]}
        onChange={setPw(field)}
        className="w-full border rounded-lg px-3 py-2 text-sm pr-10"
        placeholder="••••••••"
      />
      <button
        type="button"
        onClick={() => setShowPw((p) => ({ ...p, [showKey]: !p[showKey] }))}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400"
        aria-label={showPw[showKey] ? t('hidePassword') : t('showPassword')}
      >
        {showPw[showKey] ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FiUser className="text-primary" /> {t('myProfile')}
        </h1>
        <button onClick={logout} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-semibold">
          <FiLogOut /> {t('logOut')}
        </button>
      </div>

      {/* Profile header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 mb-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold overflow-hidden">
          {customer?.avatar_url ? <img src={fullUrl(customer.avatar_url)} alt="" className="w-full h-full object-cover" /> : initial}
        </div>
        <div className="flex-1">
          <p className="text-xl font-bold">{customer?.name || customer?.username}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">@{customer?.username || customer?.name}</p>
          {created && (
            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-1">
              <FiCalendar className="w-3 h-3" /> {t('memberSince')}: {created.toLocaleDateString()}
            </p>
          )}
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <FiEdit2 /> {t('editProfile')}
          </button>
        )}
      </div>

      {shop.template_type === 'account' && (
        <section id="top-up" className="dz-wallet-section mb-6">
          <div className="balance-card dz-balance-card">
            <div className="balance-left">
              <span className="balance-label"><FiCreditCard aria-hidden="true" /> Account Balance</span>
              <strong className="balance-amount">${Number(wallet.balance || 0).toFixed(2)}</strong>
              <span className="balance-hint">Used to purchase products</span>
            </div>
            <a href="#top-up-form" className="dz-deposit-button"><FiPlus aria-hidden="true" /> Deposit</a>
          </div>

          <div id="top-up-form" className="wallet-topup-card dz-deposit-card">
            <header className="dz-deposit-heading">
              <span className="dz-qr-symbol" aria-hidden="true">▦</span>
              <div><h2>Deposit with KHQR</h2><p>Add funds securely with any Cambodian banking app that supports KHQR</p></div>
            </header>

            {!topup ? (
              <div className="dz-deposit-form">
                <label className="wallet-custom-amount dz-amount-field"><span>DEPOSIT AMOUNT</span><div><b><FiDollarSign /></b><input type="number" min="0.10" max="1000" step="0.10" value={topupAmount} onChange={(event) => setTopupAmount(event.target.value)} placeholder="0.00" aria-label="Custom top-up amount" /><em>USD</em></div></label>
                <div className="wallet-amount-grid dz-amount-presets">
                  {TOPUP_OPTIONS.map((amount) => (
                    <button key={amount} type="button" onClick={() => setTopupAmount(String(amount))} className={Number(topupAmount) === amount ? 'wallet-amount-selected' : ''}>
                      <strong>${amount}</strong>
                    </button>
                  ))}
                </div>
                <label className="wallet-topup-telegram"><span>TELEGRAM USERNAME * · សម្រាប់ទាក់ទងអ្នក</span><input required value={topupTelegram} onChange={(event) => setTopupTelegram(event.target.value)} placeholder="@username" autoCapitalize="none" /></label>
                <button type="button" onClick={startTopup} disabled={topupBusy} className="wallet-pay-button dz-generate-button"><span aria-hidden="true">▦</span>{topupBusy ? 'Preparing payment...' : 'Generate QR Code'}</button>
                <p className="wallet-topup-note dz-secure-note"><FiShield aria-hidden="true" /> Secure payment verified by Bakong</p>
              </div>
            ) : (
              <div className="wallet-topup-qr dz-topup-qr-card">
                <div className="dz-khqr-band"><span><b aria-hidden="true">▦</b> KHQR Deposit</span><time>05:00</time></div>
                <div className="dz-khqr-body">
                  <div className="dz-khqr-meta"><div><span>MERCHANT</span><strong>{shop.shop_name || shop.username}</strong></div><div><span>AMOUNT</span><strong>${Number(topupAmount || 0).toFixed(2)} <small>{shop.currency || 'USD'}</small></strong></div></div>
                  {topup.payment?.qr_code_url && <div className="dz-khqr-qr-frame"><img src={fullUrl(topup.payment.qr_code_url)} alt="ABA KHQR payment QR" /></div>}
                  <div className="dz-payment-waiting"><i aria-hidden="true" /> Waiting for payment...</div>
                  <button type="button" onClick={confirmTopup} className="dz-confirm-payment">I've paid — Check payment</button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {topupSuccess && <div className="wallet-success-overlay" role="dialog" aria-modal="true" aria-label="Top-up successful"><section className="wallet-success-card"><FiCheckCircle className="wallet-success-icon" aria-hidden="true" /><h2>Payment Successful</h2><p>Your wallet top-up has been confirmed.</p><div className="wallet-success-summary"><span>Wallet top-up</span><strong>${topupSuccess.amount.toFixed(2)}</strong><span>New wallet balance</span><strong>${topupSuccess.balance.toFixed(2)}</strong></div><div className="wallet-success-details"><span>Payment Method</span><b>ABA KHQR</b><span>Payment Reference</span><b>{topupSuccess.reference}</b><span>Date</span><b>{topupSuccess.paidAt.toLocaleString()}</b><span>Status</span><b className="wallet-success-status">Completed</b></div><button type="button" onClick={() => setTopupSuccess(null)}>Back to Wallet</button></section></div>}

      {editing ? (
        <form onSubmit={saveProfile} className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 mb-6 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold">{t('editProfile')}</h3>
            <button type="button" onClick={() => setEditing(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400">
              <FiX className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">រូបភាព Profile</label>
              <input type="file" accept="image/*" onChange={changeAvatar} disabled={uploadingAvatar} className={inputCls} />
              {uploadingAvatar && <p className="text-xs text-gray-500 mt-1">កំពុងផ្ទុករូបភាព...</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('fullName')} *</label>
              <input value={profileForm.full_name} onChange={setProfile('full_name')} className={inputCls} autoComplete="name" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('username')} *</label>
              <input value={profileForm.username} onChange={setProfile('username')} className={inputCls} autoCapitalize="none" autoComplete="username" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('gender')}</label>
              <select value={profileForm.gender} onChange={setProfile('gender')} className={inputCls}>
                <option value="">—</option>
                <option value="male">{t('male')}</option>
                <option value="female">{t('female')}</option>
                <option value="other">{t('other')}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('gmail')}</label>
              <input type="email" value={profileForm.email} onChange={setProfile('email')} className={inputCls} placeholder="you@gmail.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('phone')}</label>
              <input value={profileForm.phone} onChange={setProfile('phone')} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('telegramPhone')}</label>
              <input value={profileForm.telegram_phone} onChange={setProfile('telegram_phone')} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Telegram username</label>
              <input value={profileForm.telegram_username} onChange={setProfile('telegram_username')} className={inputCls} placeholder="@username" autoCapitalize="none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('address')}</label>
              <input value={profileForm.address} onChange={setProfile('address')} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('city')}</label>
              <input value={profileForm.city} onChange={setProfile('city')} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('country')}</label>
              <input value={profileForm.country} onChange={setProfile('country')} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary px-5 py-2.5 rounded-xl font-semibold disabled:opacity-60 flex items-center gap-1.5">
              <FiSave /> {saving ? t('loading') : t('save')}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-xl border text-gray-600 dark:text-gray-400 font-semibold">
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow overflow-hidden mb-6">
          <div className="divide-y divide-gray-100">
          {infoRows.map((row, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
              <span className="text-sm font-semibold text-gray-800 text-right">{row.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('myOrders')}</span>
            <Link to={`${base}/my-orders`} className="text-sm font-semibold text-primary hover:underline">
              {ordersCount} {t('ordersFound')}
            </Link>
          </div>
        </div>
        </div>
      )}

      {/* Change password */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 mb-6">
        <h3 className="font-bold flex items-center gap-2 mb-4">
          <FiKey className="text-primary" /> {t('changePassword')}
        </h3>
        <form onSubmit={submitPassword} className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('currentPassword')}</label>
            {pwInput('current_password', 'current')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('newPassword')}</label>
              {pwInput('new_password', 'next')}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('confirmPassword')} *</label>
              {pwInput('confirm_password', 'confirm')}
            </div>
          </div>
          <button type="submit" disabled={changingPw} className="btn-primary px-5 py-2.5 rounded-xl font-semibold disabled:opacity-60">
            {changingPw ? t('loading') : t('updatePassword')}
          </button>
        </form>
      </div>

      <Link
        to={`${base}/my-orders`}
        className="btn-primary w-full mt-4 py-3 rounded-xl font-semibold text-center block"
      >
        <FiList className="inline mr-1" /> {t('myOrders')}
      </Link>
    </div>
  );
}
