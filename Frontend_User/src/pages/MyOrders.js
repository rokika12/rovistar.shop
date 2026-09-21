import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiClock, FiCopy, FiList, FiUser } from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { useCustomer } from '../contexts/CustomerContext';
import { useLanguage } from '../i18n';
import { getMyOrders, trackOrder, fullUrl } from '../api';
import CustomerAuth from '../components/CustomerAuth';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export function mergeOrderHistory(accountHistory = { count: 0, orders: [] }, guestOrders = []) {
  const merged = new Map();
  const accountOrders = accountHistory?.orders || [];

  [...accountOrders, ...guestOrders].forEach((order) => {
    if (!order) return;
    const key = order.id || order.order_number || `${order.created_at || ''}-${Math.random()}`;
    if (!merged.has(key)) merged.set(key, order);
  });

  return {
    count: merged.size,
    orders: [...merged.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
  };
}

// Format order times in Cambodia timezone (Asia/Phnom_Penh, UTC+7)
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString(undefined, {
      timeZone: 'Asia/Phnom_Penh',
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch (e) {
    return d.toLocaleString();
  }
};

export default function MyOrders() {
  const { shop } = useShop();
  const { token, isLoggedIn, logout } = useCustomer();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);

  const loadGuestOrders = useCallback(async () => {
    const numbers = JSON.parse(localStorage.getItem(`ms_guest_orders_${shop?.id}`) || '[]');
    const orders = (await Promise.all(numbers.map((number) => trackOrder(number).catch(() => null)))).filter(Boolean);
    return { count: orders.length, orders };
  }, [shop?.id]);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const guestHistory = await loadGuestOrders();
        if (!mounted) return;

        if (isLoggedIn && token) {
          try {
            const accountHistory = await getMyOrders(token);
            if (mounted) setHistory(mergeOrderHistory(accountHistory, guestHistory.orders));
          } catch (err) {
            if (err?.response?.status === 401) {
              logout();
              if (mounted) setHistory(guestHistory);
            } else {
              if (mounted) toast.error(err?.response?.data?.detail || 'Failed to load orders');
            }
          }
        } else {
          if (mounted) setHistory(guestHistory);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadHistory();
    return () => { mounted = false; };
  }, [isLoggedIn, loadGuestOrders, logout, token]);

  if (!shop) return null;

  const showGuestHistory = !isLoggedIn && history && history.count > 0;
  const showSignInCard = !isLoggedIn && (!history || history.count === 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FiList className="text-primary" /> {t('myOrders')}
        </h1>
        {isLoggedIn && (
          <button onClick={logout} className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500">
            {t('logOut')}
          </button>
        )}
      </div>

      {showSignInCard ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8 max-w-md mx-auto">
          <div className="w-14 h-14 mx-auto rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center mb-4">
            <FiUser className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-center">{t('signInRequired')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">{t('signInRequiredDesc')}</p>
          <div className="mt-6">
            <CustomerAuth />
          </div>
        </div>
      ) : loading && !history ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">{t('loading')}...</div>
      ) : (
        <div>
          {!history || history.count === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <FiList className="w-14 h-14 mx-auto mb-3 text-gray-200" />
              <p>{t('noOrdersFound')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {showGuestHistory && (
                <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800">
                  Guest order history is shown below.
                </p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400">{history.count} {t('ordersFound')}</p>
              {history.orders.map((o) => {
                const open = openOrder === o.id;
                const lineTotal = (item) => Number(item.price || 0) * Number(item.quantity || 1);
                const variations = (item) => (item.variations && Object.keys(item.variations).length
                  ? Object.entries(item.variations).map(([k, v]) => `${k}: ${v}`).join(' · ')
                  : '');
                const digitalItems = (o.items || []).filter((item) => item.digital_delivery);
                return (
                <div key={o.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow overflow-hidden">
                  <div className="p-5 border-b flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-sm font-bold">#{o.order_number}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fmtDate(o.created_at)} · ខ្មែរ/KH</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.payment_status === 'paid' ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex items-center gap-1">
                          <FiCheckCircle /> paid
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 flex items-center gap-1">
                          <FiClock /> {o.payment_status}
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[o.order_status] || STATUS_COLORS.pending}`}>
                        {o.order_status}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="space-y-2">
                      {o.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            {item.variations && Object.keys(item.variations).length > 0 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{Object.entries(item.variations).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
                            )}
                          </div>
                          <span className="text-gray-600 dark:text-gray-400">{item.quantity} × {item.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t mt-4 pt-3 flex justify-between font-bold">
                      <span>{t('total')}</span>
                      <span>{o.total.toFixed(2)} {o.currency}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={() => setOpenOrder(open ? null : o.id)}
                        className="text-primary text-sm font-semibold hover:underline"
                      >
                        {open ? t('hideDetail') : `↓ ${t('viewDetail')}`}
                      </button>
                      {o.receipt_url && (
                        <a href={fullUrl(o.receipt_url)} target="_blank" rel="noreferrer"
                           className="text-primary text-sm font-semibold hover:underline">
                          ↓ {t('downloadInvoice')}
                        </a>
                      )}
                    </div>
                  </div>
                {open && (
                  <div className="border-t bg-gray-50 dark:bg-gray-700/60 p-5 space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <FiList className="text-primary" /> {t('orderDetail')}
                    </h3>

                    <div className="space-y-2">
                      {o.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm bg-white dark:bg-gray-800 border rounded-lg p-3">
                          <div>
                            <p className="font-semibold">{item.product_name}</p>
                            {variations(item) && <p className="text-xs text-gray-500 dark:text-gray-400">{variations(item)}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-gray-600 dark:text-gray-400">{item.quantity} × {Number(item.price).toFixed(2)}</p>
                            <p className="font-bold">{lineTotal(item).toFixed(2)} {o.currency}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {digitalItems.length > 0 && (
                      <div className="rounded-xl border-2 border-blue-600 overflow-hidden bg-white dark:bg-gray-800">
                        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 font-bold text-blue-900 dark:text-blue-200">Digital product access</div>
                        {digitalItems.map((item, idx) => (
                          <div key={idx} className="p-4 border-t space-y-2">
                            <p className="font-semibold">{item.product_name}</p>
                            {Object.entries(item.digital_delivery || {}).filter(([, value]) => value).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2 text-sm">
                                <span className="w-28 text-gray-500 capitalize">{key.replace('_', ' ')}:</span>
                                <code className="flex-1 bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 break-all">{value}</code>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(String(value)); toast.success('Copied'); }}
                                  className="p-2 rounded bg-blue-600 text-white" title="Copy"
                                >
                                  <FiCopy />
                                </button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-sm space-y-1 bg-white dark:bg-gray-800 border rounded-lg p-3">
                      <div className="flex justify-between"><span>{t('subtotal')}</span><span>{Number(o.items_total).toFixed(2)} {o.currency}</span></div>
                      {Number(o.shipping_fee || 0) > 0 && (
                        <div className="flex justify-between"><span>{t('shipping')}</span><span>+{Number(o.shipping_fee).toFixed(2)} {o.currency}</span></div>
                      )}
                      {Number(o.discount || 0) > 0 && (
                        <div className="flex justify-between"><span>{t('discount')}</span><span>-{Number(o.discount).toFixed(2)} {o.currency}</span></div>
                      )}
                      <div className="flex justify-between font-bold border-t pt-2"><span>{t('total')}</span><span>{Number(o.total).toFixed(2)} {o.currency}</span></div>
                    </div>

                    <div className="text-sm space-y-1 bg-white dark:bg-gray-800 border rounded-lg p-3">
                      <p className="font-semibold">{t('paymentMethod')}</p>
                      <p className="capitalize">{o.payment_method || 'aba'}</p>
                      {o.transaction_id && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('transactionId')}: <span className="font-mono">{o.transaction_id}</span></p>
                      )}
                    </div>

                    <div className="text-sm space-y-1 bg-white dark:bg-gray-800 border rounded-lg p-3">
                      <p className="font-semibold">{t('customerInfo')}</p>
                      <p>{o.customer_name}</p>
                      {o.customer_phone && <p>{t('phone')}: {o.customer_phone}</p>}
                      {o.customer_email && <p>{t('email')}: {o.customer_email}</p>}
                      {o.customer_telegram && <p>Telegram: {o.customer_telegram}</p>}
                    </div>

                    {(o.customer_address || o.customer_city || o.customer_country) && (
                      <div className="text-sm space-y-1 bg-white dark:bg-gray-800 border rounded-lg p-3">
                        <p className="font-semibold">{t('shippingAddress')}</p>
                        <p>{[o.customer_address, o.customer_city, o.customer_country].filter(Boolean).join(', ')}</p>
                      </div>
                    )}
                  </div>
                )}
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
