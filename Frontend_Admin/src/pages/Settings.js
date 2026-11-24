import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getPlatformSettings, listShops, updateShop, getKhqrpayKeys, updateKhqrpayKeys, revealKhqrpayKeys } from '../api';
import { Loading, btnGhost, inputCls } from '../components/ui';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [shops, setShops] = useState([]);
  const [shopId, setShopId] = useState('');
  const [payment, setPayment] = useState({ profile_id: '', secret_key: '', test_mode: true });
  const [loading, setLoading] = useState(true);

  // KHQRPay platform-level credentials
  const [khqrpay, setKhqrpay] = useState(null);
  const [khqrEditing, setKhqrEditing] = useState(false);
  const [khqrRevealed, setKhqrRevealed] = useState(false);
  const [khqrRevealValues, setKhqrRevealValues] = useState(null);
  const [khqrForm, setKhqrForm] = useState({ secret_key: '', webhook_secret: '', base_url: '' });
  const [khqrSaving, setKhqrSaving] = useState(false);
  const [khqrRevealing, setKhqrRevealing] = useState(false);

  useEffect(() => {
    Promise.all([getPlatformSettings(), listShops(), getKhqrpayKeys()]).then(([platform, shopList, kp]) => {
      setSettings(platform);
      setShops(shopList);
      setKhqrpay(kp);
      setKhqrForm({ secret_key: '', webhook_secret: '', base_url: kp?.base_url || '' });
      if (shopList.length) {
        const firstShop = shopList[0];
        setShopId(String(firstShop.id));
        setPayment({ profile_id: firstShop.aba_settings?.profile_id || '', secret_key: firstShop.aba_settings?.secret_key || '', test_mode: firstShop.aba_settings?.test_mode !== false });
      }
    }).finally(() => setLoading(false));
  }, []);

  const selectShop = (value, shopList = shops) => {
    const shop = shopList.find((item) => String(item.id) === value);
    setShopId(value);
    setPayment({ profile_id: shop?.aba_settings?.profile_id || '', secret_key: shop?.aba_settings?.secret_key || '', test_mode: shop?.aba_settings?.test_mode !== false });
  };

  const savePayment = async () => {
    try {
      await updateShop(shopId, { aba_settings: payment });
      toast.success('Payment settings saved');
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to save payment settings'); }
  };

  const saveKhqrpay = async () => {
    setKhqrSaving(true);
    try {
      await updateKhqrpayKeys({
        secret_key: khqrForm.secret_key,
        webhook_secret: khqrForm.webhook_secret,
        base_url: khqrForm.base_url,
      });
      const kp = await getKhqrpayKeys();
      setKhqrpay(kp);
      setKhqrEditing(false);
      setKhqrForm({ secret_key: '', webhook_secret: '', base_url: kp?.base_url || '' });
      toast.success('KHQRPay keys updated');
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to update KHQRPay keys'); }
    finally { setKhqrSaving(false); }
  };

  const revealKhqrpay = async () => {
    setKhqrRevealing(true);
    try {
      const vals = await revealKhqrpayKeys();
      setKhqrRevealValues(vals);
      setKhqrRevealed(true);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to reveal KHQRPay keys'); }
    finally { setKhqrRevealing(false); }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Platform Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-lg mb-4">Contact & Account Creation</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block">Telegram Contact</label>
              <input value={settings.contact_telegram} readOnly className={`${inputCls} bg-gray-50`} />
              <p className="text-xs text-gray-400 mt-1">Users contact this Telegram account to get shop accounts created.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block">Default Admin Username</label>
              <input value={settings.default_admin} readOnly className={`${inputCls} bg-gray-50`} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-lg mb-4">Default Telegram Bot</h2>
          <p className="text-sm text-gray-500 mb-3">
            Used for platform-level notifications. Each shop configures its own bot token and chat ID in the Shop Dashboard.
          </p>
          <div>
            <label className="text-sm font-medium text-gray-700 block">Bot Token</label>
            <input
              value="•••••••••••••••• (configured securely on the server)"
              readOnly
              className={`${inputCls} bg-gray-50 font-mono text-xs`}
            />
            <p className="text-xs text-gray-400 mt-1">Tokens are stored on the server and never exposed in the frontend bundle.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-lg mb-4">Security</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex justify-between border-b pb-2">
              <span>JWT authentication</span>
              <span className="text-green-600 font-semibold">✓ Enabled</span>
            </li>
            <li className="flex justify-between border-b pb-2">
              <span>Rate limiting</span>
              <span className="text-green-600 font-semibold">✓ 60 req/min</span>
            </li>
            <li className="flex justify-between border-b pb-2">
              <span>Password hashing</span>
              <span className="text-green-600 font-semibold">✓ bcrypt</span>
            </li>
            <li className="flex justify-between border-b pb-2">
              <span>Self-registration</span>
              <span className="text-red-600 font-semibold">✗ Disabled</span>
            </li>
            <li className="flex justify-between">
              <span>File upload restrictions</span>
              <span className="text-green-600 font-semibold">✓ Images only (max 8MB)</span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-lg mb-4">Payment</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <select value={shopId} onChange={(e) => selectShop(e.target.value)} className={inputCls}>
              {shops.length === 0 && <option value="">No shops found</option>}
              {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.shop_name || shop.username} (@{shop.username})</option>)}
            </select>
            <input value={payment.profile_id} onChange={(e) => setPayment({ ...payment, profile_id: e.target.value })} className={inputCls} placeholder="ABA Profile ID / API ID" />
            <input type="password" value={payment.secret_key} onChange={(e) => setPayment({ ...payment, secret_key: e.target.value })} className={inputCls} placeholder="ABA Secret Key / API Key" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={payment.test_mode} onChange={(e) => setPayment({ ...payment, test_mode: e.target.checked })} /> Sandbox / test mode
            </label>
            <button onClick={savePayment} disabled={!shopId} className={`${btnGhost} disabled:opacity-50`}>Save Payment Settings</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">KHQRPay API Key</h2>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${khqrpay?.configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {khqrpay?.configured ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Platform-level KHQRPay credentials used for the checkout QR and payment webhooks.
            Keys are encrypted in the database and never returned in full here — click <strong>View</strong> to reveal them.
            Rotating these keys does not require touching Render environment variables.
          </p>

          {!khqrEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block">Secret Key</label>
                <div className="flex items-center gap-2">
                  <input
                    value={khqrRevealed && khqrRevealValues?.secret_key ? khqrRevealValues.secret_key : (khqrpay?.secret_key || '—')}
                    readOnly
                    className={`${inputCls} bg-gray-50 font-mono text-xs`}
                  />
                  {khqrRevealed && khqrRevealValues?.secret_key && (
                    <button onClick={() => { navigator.clipboard?.writeText(khqrRevealValues.secret_key); toast.success('Copied'); }}
                      className={`${btnGhost} whitespace-nowrap`}>Copy</button>
                  )}
                </div>
                {khqrpay?.secret_key_source && (
                  <p className="text-xs text-gray-400 mt-1">Source: {khqrpay.secret_key_source}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block">Webhook Secret</label>
                <div className="flex items-center gap-2">
                  <input
                    value={khqrRevealed && khqrRevealValues?.webhook_secret ? khqrRevealValues.webhook_secret : (khqrpay?.webhook_secret || '—')}
                    readOnly
                    className={`${inputCls} bg-gray-50 font-mono text-xs`}
                  />
                  {khqrRevealed && khqrRevealValues?.webhook_secret && (
                    <button onClick={() => { navigator.clipboard?.writeText(khqrRevealValues.webhook_secret); toast.success('Copied'); }}
                      className={`${btnGhost} whitespace-nowrap`}>Copy</button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block">Base URL</label>
                <input value={khqrpay?.base_url || ''} readOnly className={`${inputCls} bg-gray-50 font-mono text-xs`} />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => { setKhqrEditing(true); setKhqrRevealed(false); }}
                  className={`${btnGhost}`}>Change</button>
                <button onClick={revealKhqrpay} disabled={khqrRevealing}
                  className={`${btnGhost} disabled:opacity-50`}>{khqrRevealing ? 'Loading…' : (khqrRevealed ? 'Hide' : 'View')}</button>
                {khqrRevealed && (
                  <button onClick={() => setKhqrRevealed(false)} className={`${btnGhost}`}>Hide values</button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Leave a field blank to keep its current value. Empty fields are not cleared.</p>
              <div>
                <label className="text-sm font-medium text-gray-700 block">New Secret Key</label>
                <input type="password" value={khqrForm.secret_key}
                  onChange={(e) => setKhqrForm({ ...khqrForm, secret_key: e.target.value })}
                  placeholder="kp_live_…" className={`${inputCls} font-mono text-xs`} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block">New Webhook Secret</label>
                <input type="password" value={khqrForm.webhook_secret}
                  onChange={(e) => setKhqrForm({ ...khqrForm, webhook_secret: e.target.value })}
                  className={`${inputCls} font-mono text-xs`} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block">Base URL (optional)</label>
                <input value={khqrForm.base_url}
                  onChange={(e) => setKhqrForm({ ...khqrForm, base_url: e.target.value })}
                  placeholder="https://khqrpay.dev" className={`${inputCls} font-mono text-xs`} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveKhqrpay} disabled={khqrSaving}
                  className={`${btnGhost} disabled:opacity-50`}>{khqrSaving ? 'Saving…' : 'Save keys'}</button>
                <button onClick={() => { setKhqrEditing(false); setKhqrForm({ secret_key: '', webhook_secret: '', base_url: khqrpay?.base_url || '' }); }}
                  className={`${btnGhost}`}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <strong>Note:</strong> Configure each shop&apos;s ABA Profile ID and Secret/API Key from
        <strong> Shops → Manage → Overview</strong>. KHQRPay platform credentials are managed above
        (encrypted at rest; rotate without redeploying). Secret values are only returned to
        authenticated admins and are never exposed through the public storefront. Rate-limit tuning
        is done in the backend config (<code className="font-mono">Backend_API/config.py</code>).
      </div>
    </div>
  );
}
