import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiDownloadCloud, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { createProvider, importProviderProducts, listProviderItems, listProviders, listShops, refreshProviderCatalog } from '../api';
import { btnGhost, btnPrimary, inputCls } from '../components/ui';

const empty = { name: '', catalog_url: '', api_key: '', auth_header: 'Authorization' };

export default function ProviderCatalog() {
  const [providers, setProviders] = useState([]);
  const [shops, setShops] = useState([]);
  const [form, setForm] = useState(empty);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [items, setItems] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [shopId, setShopId] = useState('');
  const [margin, setMargin] = useState('0');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [nextProviders, nextShops] = await Promise.all([listProviders(), listShops()]);
      setProviders(nextProviders); setShops(nextShops);
    } catch (error) { toast.error(error?.response?.data?.detail || 'Could not load provider catalog'); }
  };
  useEffect(() => { load(); }, []);

  const pickProvider = async (id) => {
    setSelectedProvider(id); setChosen([]);
    if (!id) return setItems([]);
    try { setItems(await listProviderItems(id)); }
    catch (error) { toast.error(error?.response?.data?.detail || 'Could not load imported games'); }
  };
  const addProvider = async (event) => {
    event.preventDefault(); setBusy(true);
    try { const provider = await createProvider(form); await load(); setForm(empty); await pickProvider(String(provider.id)); toast.success('Provider saved securely'); }
    catch (error) { toast.error(error?.response?.data?.detail || 'Provider could not be saved'); }
    finally { setBusy(false); }
  };
  const refresh = async () => {
    if (!selectedProvider) return;
    setBusy(true);
    try { const result = await refreshProviderCatalog(selectedProvider); await pickProvider(selectedProvider); await load(); toast.success(`Loaded ${result.total_games} games`); }
    catch (error) { toast.error(error?.response?.data?.detail || 'Could not connect to the provider'); }
    finally { setBusy(false); }
  };
  const toggle = (id) => setChosen((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]);
  const importSelected = async () => {
    if (!shopId || !chosen.length) return toast.error('Choose a shop and at least one game');
    setBusy(true);
    try { const result = await importProviderProducts({ provider_id: Number(selectedProvider), shop_id: Number(shopId), item_ids: chosen, margin_percent: Number(margin || 0) }); toast.success(`${result.count} products added to the selected shop`); setChosen([]); }
    catch (error) { toast.error(error?.response?.data?.detail || 'Import failed'); }
    finally { setBusy(false); }
  };

  return <div className="max-w-6xl">
    <h1 className="text-2xl font-bold">Provider Game Catalog</h1>
    <p className="text-sm text-slate-500 mt-1">Admin only. Add a supplier's documented HTTPS catalog endpoint, import the games you choose, and set your selling margin.</p>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      <form onSubmit={addProvider} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><FiPlus /> Add API provider</h2>
        <input className={inputCls} required placeholder="Provider name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={inputCls} required type="url" placeholder="https://supplier.example/api/catalog" value={form.catalog_url} onChange={(e) => setForm({ ...form, catalog_url: e.target.value })} />
        <input className={inputCls} placeholder="API key (stored on the server)" type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
        <input className={inputCls} placeholder="API key header, e.g. Authorization" value={form.auth_header} onChange={(e) => setForm({ ...form, auth_header: e.target.value })} />
        <button className={`${btnPrimary} w-full`} disabled={busy}>Save provider</button>
      </form>
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex-1 min-w-52 text-sm font-medium">Provider<select className={`${inputCls} mt-1`} value={selectedProvider} onChange={(e) => pickProvider(e.target.value)}><option value="">Choose provider</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}{provider.api_key_configured ? ' (key saved)' : ''}</option>)}</select></label>
          <button className={btnGhost} onClick={refresh} disabled={busy || !selectedProvider}><FiRefreshCw className="inline mr-1" /> Fetch catalog</button>
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg mt-4">Automatic ID validation and top-up are disabled until the provider gives you official API documentation for those endpoints. This tool does not use consumer checkout pages or private APIs.</p>
        {selectedProvider && <div className="mt-4">
          <div className="flex flex-wrap gap-3 items-end mb-3"><label className="text-sm">Shop<select className={`${inputCls} mt-1`} value={shopId} onChange={(e) => setShopId(e.target.value)}><option value="">Choose shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.shop_name || shop.username}</option>)}</select></label><label className="text-sm">Profit margin (%)<input className={`${inputCls} mt-1 w-32`} type="number" min="0" value={margin} onChange={(e) => setMargin(e.target.value)} /></label><button onClick={importSelected} disabled={busy || !chosen.length} className={btnPrimary}><FiDownloadCloud className="inline mr-1" /> Import {chosen.length}</button></div>
          <p className="text-sm text-slate-500 mb-2">Imported catalog: {items.length} games/products</p>
          <div className="border rounded-lg max-h-96 overflow-auto">{items.map((item) => <label key={item.id} className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-slate-50"><input type="checkbox" checked={chosen.includes(item.id)} onChange={() => toggle(item.id)} /><span className="flex-1"><strong>{item.name}</strong><small className="block text-slate-500">Supplier ID: {item.external_id}</small></span><span>${Number(item.cost_price || 0).toFixed(2)}</span></label>)}{!items.length && <p className="p-5 text-sm text-slate-500">Choose a provider, then fetch its official catalog.</p>}</div>
        </div>}
      </div>
    </div>
  </div>;
}
