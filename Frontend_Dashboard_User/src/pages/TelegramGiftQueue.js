import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheck, FiExternalLink, FiSend } from 'react-icons/fi';
import { createTelegramGiftQueue, listTelegramGiftQueue, publishTelegramGift } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { btnPrimary, inputCls } from '../components/ui';

export default function TelegramGiftQueue() {
  const { user } = useAuth();
  const [links, setLinks] = useState('');
  const [price, setPrice] = useState('');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = () => listTelegramGiftQueue(user.shop_id).then(setItems).catch(() => toast.error('មិនអាចទាញ Telegram Queue បាន'));
  useEffect(() => { load(); }, [user.shop_id]);

  const addLinks = async (event) => {
    event.preventDefault();
    const urls = links.split(/\n|,/).map((v) => v.trim()).filter(Boolean);
    const usd = Number(price);
    if (!urls.length || !Number.isFinite(usd) || usd <= 0) { toast.error('បញ្ចូល Telegram link និងតម្លៃ USD'); return; }
    setBusy(true);
    try {
      await Promise.all(urls.map((url) => createTelegramGiftQueue({ shop_id: user.shop_id, url, price: usd })));
      setLinks(''); setPrice(''); await load(); toast.success(`បានបញ្ចូល ${urls.length} Gift ទៅ Queue`);
    } catch (error) { toast.error(error?.response?.data?.detail || 'Telegram link មិនត្រឹមត្រូវ'); }
    finally { setBusy(false); }
  };

  const publish = async (item) => {
    setBusy(true);
    try {
      await publishTelegramGift(item.id, { price: Number(item.price), name: item.title, description: item.description });
      await load(); toast.success('Gift បានបាញ់ចូលហាងរួច');
    } catch (error) { toast.error(error?.response?.data?.detail || 'មិនអាចបាញ់ចូលហាងបាន'); }
    finally { setBusy(false); }
  };

  return <div className="max-w-6xl space-y-6">
    <div><h1 className="text-2xl font-bold">Telegram Gift Queue</h1><p className="mt-1 text-sm text-slate-500">ដាក់ link Gift ពី Telegram, ពិនិត្យព័ត៌មានសាធារណៈ ហើយចុចបាញ់ចូលហាង។ អ្នកត្រូវពិនិត្យ ownership និងផ្ញើ Gift ដោយដៃក្រោយពេលលក់។</p></div>
    <form onSubmit={addLinks} className="rounded-2xl bg-white p-5 shadow-sm">
      <label className="mb-2 block text-sm font-semibold text-slate-700">Telegram Gift links</label>
      <textarea value={links} onChange={(e) => setLinks(e.target.value)} className={`${inputCls} min-h-28`} placeholder={'https://t.me/nft/ChillFlame-13081\nhttps://t.me/nft/ChillFlame-193691'} />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row"><input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0.01" step="0.01" className={inputCls} placeholder="តម្លៃលក់ USD" /><button disabled={busy} className={btnPrimary}><FiSend /> បញ្ចូលទៅ Queue</button></div>
    </form>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl bg-white shadow-sm"><img src={item.image_url} alt={item.title} className="h-56 w-full object-cover" /><div className="space-y-3 p-4"><div><h2 className="font-bold text-slate-900">{item.title}</h2><p className="mt-1 text-sm text-slate-500">{item.description}</p></div><div className="flex items-center justify-between"><strong className="text-lg text-emerald-600">${Number(item.price).toFixed(2)}</strong><a href={item.canonical_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600">View Telegram <FiExternalLink /></a></div>{item.status === 'published' ? <p className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600"><FiCheck /> In store</p> : <button disabled={busy} onClick={() => publish(item)} className={`${btnPrimary} w-full justify-center`}>បាញ់ចូលហាង</button>}</div></article>)}</div>
  </div>;
}
