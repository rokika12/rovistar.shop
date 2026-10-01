import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiExternalLink, FiGlobe, FiMessageCircle, FiPenTool, FiSend } from 'react-icons/fi';
import { applyDesignReference, completePorkbunConnect, createDomainMapping, inspectDesignReference, listDomainMappings, listShops, porkbunStatus, startPorkbunConnect } from '../api';

export default function AutomationTools() {
  const [shops, setShops] = useState([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [reference, setReference] = useState(null);
  const [selectedShop, setSelectedShop] = useState('');
  const [domain, setDomain] = useState('');
  const [domains, setDomains] = useState([]);
  const [busy, setBusy] = useState(false);
  const [porkbun, setPorkbun] = useState({ connected: false, pending: false });

  const refresh = async () => {
    const [shopData, domainData, porkbunData] = await Promise.all([listShops(), listDomainMappings(), porkbunStatus()]);
    setShops(shopData); setDomains(domainData); setPorkbun(porkbunData);
    if (!selectedShop && shopData[0]) setSelectedShop(String(shopData[0].id));
  };
  const connectPorkbun = async () => { try { const result = await startPorkbunConnect(); setPorkbun({ connected: false, pending: true }); window.location.assign(result.auth_url); } catch (error) { toast.error(error.response?.data?.detail || 'Unable to start Porkbun connection'); } };
  const completePorkbun = async () => { try { await completePorkbunConnect(); await refresh(); toast.success('Porkbun connected securely.'); } catch (error) { toast.error(error.response?.data?.detail || 'Approval is still pending'); } };
  useEffect(() => { refresh().catch(() => toast.error('មិនអាចទាញទិន្នន័យបាន')); }, []);

  const inspect = async (event) => {
    event.preventDefault(); setBusy(true);
    try { setReference(await inspectDesignReference({ url: sourceUrl })); }
    catch (error) { toast.error(error.response?.data?.detail || 'មិនអាចវិភាគ website បាន'); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!reference || !selectedShop) return;
    setBusy(true);
    try { await applyDesignReference({ shop_id: Number(selectedShop), theme: reference.suggested_theme }); toast.success('បាន apply style ទៅហាងរួច'); }
    catch (error) { toast.error(error.response?.data?.detail || 'មិនអាច apply បាន'); }
    finally { setBusy(false); }
  };
  const addDomain = async (event) => {
    event.preventDefault(); setBusy(true);
    try { await createDomainMapping({ shop_id: Number(selectedShop), domain }); setDomain(''); await refresh(); toast.success('បានបន្ថែម domain រួច'); }
    catch (error) { toast.error(error.response?.data?.detail || 'មិនអាចបន្ថែម domain បាន'); }
    finally { setBusy(false); }
  };

  return <div className="max-w-6xl space-y-7">
    <div><h2 className="text-2xl font-bold text-slate-900">Tools for Website & Support</h2><p className="text-slate-500 mt-1">Design reference, domain mapping, and live customer chat.</p></div>
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex gap-3 items-start"><span className="p-3 bg-amber-100 text-amber-700 rounded-xl"><FiPenTool /></span><div><h3 className="font-bold text-slate-900">1. Design Reference Importer</h3><p className="text-sm text-slate-500">Read public colors and fonts, then apply original design tokens to a selected shop.</p></div></div>
      <form onSubmit={inspect} className="mt-5 flex flex-col sm:flex-row gap-3"><input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} required type="url" placeholder="https://example.com" className="flex-1 border rounded-xl px-4 py-3"/><button disabled={busy} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-semibold">Analyze style</button></form>
      {reference && <div className="mt-5 rounded-xl bg-slate-50 p-5 grid md:grid-cols-[1fr_auto] gap-5 items-end"><div><a className="font-semibold text-slate-900 inline-flex gap-2" href={reference.source_url} target="_blank" rel="noreferrer">{reference.title} <FiExternalLink /></a><p className="text-xs text-slate-500 mt-1">{reference.notice}</p><div className="flex flex-wrap gap-2 mt-3">{reference.colors.map((color) => <span key={color} className="px-3 py-1 rounded-full text-xs border bg-white" style={{ borderColor: color }}><b style={{ color }}>{color}</b></span>)}</div><p className="text-sm text-slate-600 mt-3">Font: {reference.fonts.join(', ') || 'No public font detected'}</p><p className="text-sm text-slate-600 mt-2">Button style: {reference.component_notes?.button_shape}</p>{reference.buttons?.length > 0 && <p className="text-sm text-slate-600 mt-2">Buttons found: {reference.buttons.join(' · ')}</p>}{reference.menus?.length > 0 && <p className="text-sm text-slate-600 mt-2">Menu items found: {reference.menus.join(' · ')}</p>}<p className="text-xs text-slate-500 mt-3">{reference.component_notes?.payment_note}</p></div><div className="flex gap-2"><select value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)} className="border rounded-xl p-3">{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.shop_name || shop.username}</option>)}</select><button onClick={apply} disabled={busy} type="button" className="bg-amber-500 text-slate-950 px-4 rounded-xl font-bold">Apply style</button></div></div>}
    </section>
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex gap-3 items-start"><span className="p-3 bg-sky-100 text-sky-700 rounded-xl"><FiGlobe /></span><div className="flex-1"><h3 className="font-bold text-slate-900">2. Custom Domain Manager</h3><p className="text-sm text-slate-500">Connect Porkbun once, then point a purchased domain directly to the selected customer shop.</p></div>{porkbun.connected ? <span className="text-sm font-bold text-emerald-700">Porkbun connected</span> : <div className="flex gap-2"><button type="button" onClick={connectPorkbun} className="border border-sky-600 text-sky-700 px-3 py-2 rounded-lg text-sm font-semibold">Connect Porkbun</button>{porkbun.pending && <button type="button" onClick={completePorkbun} className="bg-sky-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">Complete</button>}</div>}</div>
      <p className={`mt-3 text-sm ${porkbun.connected ? 'text-emerald-700' : 'text-amber-700'}`}>{porkbun.connected ? 'Connected: enter a purchased Porkbun domain, choose a shop, then press Add domain.' : porkbun.pending ? 'Step 2: approve Rovistar in Porkbun, return here, then press Complete.' : 'Step 1: press Connect Porkbun and approve access before adding a domain.'}</p>
      <form onSubmit={addDomain} className="mt-5 grid sm:grid-cols-[1fr_220px_auto] gap-3"><input value={domain} onChange={(e) => setDomain(e.target.value)} required placeholder="customer-shop.com" className="border rounded-xl px-4 py-3"/><select value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)} className="border rounded-xl px-3">{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.shop_name || shop.username}</option>)}</select><button disabled={busy} className="bg-sky-600 text-white px-5 rounded-xl font-semibold">Add domain</button></form>
      <div className="mt-5 divide-y">{domains.map((item) => <div key={item.id} className="py-3 flex justify-between gap-4 text-sm"><span><b>{item.domain}</b><span className="text-slate-500"> → shop #{item.shop_id}</span></span><span className="text-amber-700 font-medium">{item.status}</span></div>)}{!domains.length && <p className="text-sm text-slate-500">No domains added yet.</p>}</div>
    </section>
    <section className="bg-slate-900 text-white rounded-2xl p-6 flex items-center justify-between gap-5"><div className="flex gap-3"><span className="p-3 bg-white/10 rounded-xl"><FiMessageCircle /></span><div><h3 className="font-bold">3. Live Support</h3><p className="text-sm text-slate-300">The customer chat bubble is enabled across storefronts. New chats alert the shop Telegram bot and appear in the Admin inbox.</p></div></div><a href="/support" className="shrink-0 bg-white text-slate-900 px-4 py-3 rounded-xl font-bold inline-flex gap-2">Open inbox <FiSend /></a></section>
  </div>;
}
