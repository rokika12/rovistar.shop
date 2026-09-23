import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiCreditCard, FiEye, FiEyeOff, FiLock, FiRefreshCw } from 'react-icons/fi';
import { getShopDetail, testPayment, updateShop } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Loading, btnPrimary, btnGhost, inputCls } from '../components/ui';

export default function PaymentSettings() {
  const { user } = useAuth();
  const [aba, setAba] = useState({ profile_id: '', secret_key: '', test_mode: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    getShopDetail(user.shop_id).then((s) => {
      setAba({
        profile_id: s.aba_settings?.profile_id || '',
        secret_key: s.aba_settings?.secret_key || '',
        test_mode: s.aba_settings?.test_mode ?? true,
      });
    }).finally(() => setLoading(false));
  }, [user.shop_id]);

  const save = async () => {
    setSaving(true);
    try {
      await updateShop(user.shop_id, { aba_settings: aba });
      toast.success('Payment settings saved!');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const res = await testPayment(user.shop_id);
      toast.success('ABA configuration valid!');
      setTestResult(res);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Test failed');
      setTestResult(null);
    } finally {
      setTesting(false);
    }
  };

  const [testResult, setTestResult] = useState(null);

  if (loading) return <Loading />;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-[#011F46] to-[#0a4b7d] p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><FiCreditCard className="text-xl" /></span>
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Payment setup</p><h1 className="text-2xl font-black">ABA Pay / KHQR</h1><p className="mt-1 max-w-lg text-sm text-blue-100">Save your merchant details once. Customers will then receive a secure KHQR at checkout.</p></div>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${aba.profile_id && aba.secret_key ? 'bg-emerald-400/20 text-emerald-100' : 'bg-amber-300/20 text-amber-100'}`}>{aba.profile_id && aba.secret_key ? '● Ready to test' : '● Credentials needed'}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-100 space-y-5">
        <div><h2 className="font-bold text-slate-900">ព័ត៌មានគណនី ABA</h2><p className="mt-1 text-sm text-slate-500">បញ្ចូល Profile ID និង Secret Key ដែលទទួលពី ABA Pay / KHQRcc។ ព័ត៌មាននេះគឺសម្រាប់ហាងនេះតែប៉ុណ្ណោះ។</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Profile ID / Merchant ID</label><input value={aba.profile_id} onChange={(e) => setAba({ ...aba, profile_id: e.target.value })} className={inputCls} placeholder="e.g. 102001234567890" autoComplete="off" /></div>
          <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Secret Key</label><div className="relative"><input type={showSecret ? 'text' : 'password'} value={aba.secret_key} onChange={(e) => setAba({ ...aba, secret_key: e.target.value })} className={`${inputCls} pr-11`} placeholder="Paste your secret key" autoComplete="new-password" /><button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label={showSecret ? 'Hide secret key' : 'Show secret key'}>{showSecret ? <FiEyeOff /> : <FiEye />}</button></div></div>
        </div>
        <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${aba.test_mode ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><input type="checkbox" checked={aba.test_mode} onChange={(e) => setAba({ ...aba, test_mode: e.target.checked })} className="mt-0.5 h-4 w-4" /><span><b className="block text-slate-800">Test mode</b><span className="text-xs text-slate-600">{aba.test_mode ? 'Test payments auto-succeed. Turn this off only when you are ready for real customer payments.' : 'Live mode is enabled. Customers will make real ABA payments.'}</span></span></label>
        <div className="flex flex-wrap items-center gap-3 border-t pt-5"><button onClick={save} disabled={saving} className={btnPrimary}>{saving ? 'Saving...' : 'Save ABA settings'}</button><button onClick={runTest} disabled={testing || !aba.profile_id || !aba.secret_key} className={btnGhost}>{testing ? 'Testing...' : <><FiRefreshCw className="inline" /> Test connection</>}</button><span className="flex items-center gap-1 text-xs text-slate-400"><FiLock /> Stored securely for this shop</span></div>

        {testResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
            <p className="font-semibold text-emerald-700 mb-1 flex items-center gap-2"><FiCheckCircle /> Connection successful</p>
            <p className="text-emerald-700 break-all">Transaction: {testResult.transaction_id}</p>
            <a href={testResult.checkout_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-xs block mt-2">Open test checkout URL ↗</a>
          </div>
        )}

      </div>
      <div className="grid gap-3 text-sm md:grid-cols-3"><div className="rounded-xl bg-white p-4 shadow-sm"><b>1. Save</b><p className="mt-1 text-xs text-slate-500">Save the two credentials.</p></div><div className="rounded-xl bg-white p-4 shadow-sm"><b>2. Test</b><p className="mt-1 text-xs text-slate-500">Confirm the gateway can create a payment.</p></div><div className="rounded-xl bg-white p-4 shadow-sm"><b>3. Go live</b><p className="mt-1 text-xs text-slate-500">Turn off test mode for real payments.</p></div></div>
    </div>
  );
}
