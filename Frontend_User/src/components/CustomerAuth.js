import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiEye, FiEyeOff, FiUserPlus } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { useShop } from '../contexts/ShopContext';
import { useCustomer } from '../contexts/CustomerContext';
import { useOwner } from '../contexts/OwnerContext';
import { useLanguage } from '../i18n';

export default function CustomerAuth({ onSuccess }) {
  const { shop } = useShop();
  const { signin, signup } = useCustomer();
  const { login: ownerLogin } = useOwner();
  const { t } = useLanguage();
  const [mode, setMode] = useState('signin');
  const [busy, setBusy] = useState(false);

  // No credentials are stored in the browser (security).
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // One-time cleanup: remove credentials saved by older app versions.
  useEffect(() => {
    localStorage.removeItem('ms_saved_username');
    localStorage.removeItem('ms_saved_password');
  }, []);
  const [signupForm, setSignupForm] = useState({ email: '', password: '', confirm_password: '' });

  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const set = (obj, setObj) => (field) => (e) => setObj({ ...obj, [field]: e.target.value });

  const handleSignin = async (e) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      toast.error(t('fillRequired'));
      return;
    }
    setBusy(true);
    try {
      await signin(shop.id, loginForm.username, loginForm.password);
      toast.success(t('tgLoginSuccess'));
      if (onSuccess) onSuccess();
    } catch (customerErr) {
      // Not a customer account — maybe this is the shop admin/owner. Try the
      // shop-owner login: if the account owns THIS shop, the Dashboard button
      // appears (server-verified). Regular users never get the button.
      try {
        const ownerRes = await ownerLogin(loginForm.username, loginForm.password);
        if (ownerRes.user.role !== 'shop_owner' && ownerRes.user.role !== 'staff') {
          toast.error('This account is not a shop owner account.');
          return;
        }
        toast.success(`Welcome, ${ownerRes.user.username}!`);
        if (onSuccess) onSuccess();
      } catch (ownerErr) {
        toast.error(customerErr?.response?.data?.detail || 'Login failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!signupForm.email || !signupForm.password) {
      toast.error(t('fillRequired'));
      return;
    }
    if (signupForm.password !== signupForm.confirm_password) {
      toast.error(t('passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      // confirm_password is only a frontend check — don't send it to the API.
      const { confirm_password, ...payload } = signupForm;
      await signup(shop.id, payload);
      toast.success(t('tgLoginSuccess'));
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Sign up failed');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200';

  // Password input with a show/hide (eye) toggle button.
  const passwordInput = (value, onChange, show, setShow) => (
    <div className="relative mt-1">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        className="w-full border rounded-lg px-3 py-2 text-sm pr-10 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
        placeholder="••••••••"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        tabIndex={-1}
        title={show ? t('hidePassword') : t('showPassword')}
        aria-label={show ? t('hidePassword') : t('showPassword')}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div>
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'signin' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
        >
          <span className="inline-flex items-center justify-center gap-1.5"><FcGoogle className="w-4 h-4" /> {t('signIn')}</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'signup' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
        >
          {t('signUp')}
        </button>
      </div>

      {mode === 'signin' ? (
        <form onSubmit={handleSignin} className="space-y-3 text-left">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Gmail / {t('username')} *</label>
            <input
              value={loginForm.username}
              onChange={set(loginForm, setLoginForm)('username')}
              className={inputCls}
              placeholder="name@gmail.com"
              autoCapitalize="none"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('password')} *</label>
            {passwordInput(loginForm.password, set(loginForm, setLoginForm)('password'), showLoginPw, setShowLoginPw)}
          </div>
          <button type="submit" disabled={busy} className="w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-60">
            {busy ? t('loading') : t('signIn')}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="space-y-3 text-left">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Gmail *</label>
            <input type="email" value={signupForm.email} onChange={set(signupForm, setSignupForm)('email')} className={inputCls} placeholder="you@gmail.com" autoComplete="email" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('password')} *</label>
            {passwordInput(signupForm.password, set(signupForm, setSignupForm)('password'), showSignupPw, setShowSignupPw)}
            <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] font-bold"><span className={`rounded px-2 py-1 text-center ${signupForm.password.length >= 4 ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}>Level 1</span><span className={`rounded px-2 py-1 text-center ${signupForm.password.length >= 8 && /[A-Z]/.test(signupForm.password) && /\d/.test(signupForm.password) ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'}`}>Level 2</span><span className={`rounded px-2 py-1 text-center ${signupForm.password.length >= 12 && /[A-Z]/.test(signupForm.password) && /\d/.test(signupForm.password) && /[^A-Za-z0-9]/.test(signupForm.password) ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'}`}>Level 3</span></div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('confirmPassword')} *</label>
            {passwordInput(signupForm.confirm_password, set(signupForm, setSignupForm)('confirm_password'), showConfirmPw, setShowConfirmPw)}
          </div>
          <button type="submit" disabled={busy} className="w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            <FiUserPlus /> {busy ? t('loading') : t('createAccount')}
          </button>
        </form>
      )}
    </div>
  );
}
