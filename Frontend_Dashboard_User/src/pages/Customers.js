import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { listCustomers } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Empty, Loading, Modal, btnPrimary, inputCls } from '../components/ui';

export default function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', telegram: '', address: '', city: '', country: '', password: '' });

  const load = () => listCustomers(user.shop_id, search).then(setCustomers).finally(() => setLoading(false));
  useEffect(() => { load(); }, [user.shop_id, search]);

  const openCustomer = (c) => setSelected(c);

  const createCustomer = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      // Use the internal API to create customer with password
      const { createCustomerWithPassword } = require('../api');
      await createCustomerWithPassword({ ...newCustomer, shop_id: user.shop_id });
      toast.success('បានបង្កើតអតិថិជនដោយជោគជ័យ!');
      setShowCreate(false);
      setNewCustomer({ name: '', phone: '', email: '', telegram: '', address: '', city: '', country: '', password: '' });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'បរាជ័យក្នុងការបង្កើតអតិថិជន');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">អតិថិជន</h1>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ស្វែងរកតាមឈ្មោះ លេខទូរស័ព្ទ តេឡេក្រាម..."
            className="bg-white border rounded-lg px-3 py-2 text-sm w-64"
          />
          <button onClick={() => setShowCreate(true)} className={btnPrimary}>+ បន្ថែមអតិថិជន</button>
        </div>
      </div>

      {/* Create Customer Modal */}
      <Modal open={showCreate} title="បន្ថែមអតិថិជនថ្មី" onClose={() => setShowCreate(false)}>
        <form onSubmit={createCustomer} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block">ឈ្មោះអតិថិជន *</label>
            <input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} className={inputCls} placeholder="ឈ្មោះពេញ" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block">លេខទូរស័ព្ទ *</label>
              <input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} className={inputCls} placeholder="+855 12 345 678" required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block">អ៊ីមែល (Gmail)</label>
              <input value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} className={inputCls} placeholder="example@gmail.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block">តេឡេក្រាម</label>
              <input value={newCustomer.telegram} onChange={(e) => setNewCustomer({ ...newCustomer, telegram: e.target.value })} className={inputCls} placeholder="@username" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block">ពាក្យសម្ងាត់</label>
              <input value={newCustomer.password} onChange={(e) => setNewCustomer({ ...newCustomer, password: e.target.value })} className={inputCls} placeholder="ពាក្យសម្ងាត់សំរាប់អតិថិជន" />
              <p className="text-xs text-gray-400 mt-1">អតិថិជនអាចប្រើពាក្យសម្ងាត់នេះដើម្បីចូលគណនី</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block">អាសយដ្ឋាន</label>
            <input value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} className={inputCls} placeholder="អាសយដ្ឋាន" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block">ទីក្រុង</label>
              <input value={newCustomer.city} onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })} className={inputCls} placeholder="ភ្នំពេញ" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block">ប្រទេស</label>
              <input value={newCustomer.country} onChange={(e) => setNewCustomer({ ...newCustomer, country: e.target.value })} className={inputCls} placeholder="កម្ពុជា" />
            </div>
          </div>
          <button type="submit" disabled={creating} className={btnPrimary}>
            {creating ? 'កំពុងបង្កើត...' : 'បង្កើតអតិថិជន'}
          </button>
        </form>
      </Modal>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? <Loading /> : customers.length === 0 ? <Empty message="មិនទាន់មានអតិថិជន" /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">អតិថិជន</th>
                <th className="px-4 py-3">លេខទូរស័ព្ទ</th>
                <th className="px-4 py-3">តេឡេក្រាម</th>
                <th className="px-4 py-3">ទីក្រុង</th>
                <th className="px-4 py-3">ការបញ្ជាទិញ</th>
                <th className="px-4 py-3">ថ្ងៃចូលជាលើកដំបូង</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openCustomer(c)}>
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.telegram || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.city || '—'}</td>
                  <td className="px-4 py-3">{c.order_count}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!selected} title="ព័ត៌មានលម្អិតអតិថិជន" onClose={() => setSelected(null)} wide>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">ឈ្មោះ</p><p className="font-semibold">{selected.name}</p></div>
              <div><p className="text-xs text-gray-500">លេខទូរស័ព្ទ</p><p>{selected.phone}</p></div>
              <div><p className="text-xs text-gray-500">តេឡេក្រាម</p><p>{selected.telegram || '—'}</p></div>
              <div><p className="text-xs text-gray-500">អ៊ីមែល (Gmail)</p><p>{selected.email || '—'}</p></div>
              <div><p className="text-xs text-gray-500">អាសយដ្ឋាន</p><p>{selected.address || '—'}</p></div>
              <div><p className="text-xs text-gray-500">ទីក្រុង / ប្រទេស</p><p>{selected.city}, {selected.country}</p></div>
            </div>
            {selected.plain_password && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm font-bold text-emerald-700">ពាក្យសម្ងាត់របស់អតិថិជន</p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 bg-white border rounded-lg px-3 py-2 text-sm font-mono">{selected.plain_password}</code>
                  <button onClick={() => { navigator.clipboard.writeText(selected.plain_password); toast.success('ចម្លងពាក្យសម្ងាត់ដោយជោគជ័យ!'); }} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">ចម្លង</button>
                </div>
                <p className="text-xs text-emerald-600 mt-1">អតិថិជនអាចប្រើអ៊ីមែល + ពាក្យសម្ងាត់នេះដើម្បីចូលគណនី</p>
              </div>
            )}
            <div>
              <h3 className="font-bold text-sm mb-2">ប្រវត្តិការបញ្ជាទិញ ({selected.orders?.length || 0})</h3>
              <div className="space-y-2">
                {selected.orders && selected.orders.length > 0 ? selected.orders.map((o) => (
                  <div key={o.id} className="flex justify-between items-center bg-gray-50 rounded-lg p-3 text-sm">
                    <span className="font-mono text-xs font-semibold">#{o.order_number}</span>
                    <span className="text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString()}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${o.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{o.payment_status}</span>
                    <span className="font-bold">{o.total.toFixed(2)} {o.currency}</span>
                  </div>
                )) : <p className="text-sm text-gray-400">No orders yet.</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
