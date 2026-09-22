import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiPackage, FiPlusCircle, FiTag } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { listProducts, fullUrl } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Loading, btnPrimary } from '../components/ui';

const PLATFORM_META = {
  facebook: { label: 'Facebook', color: 'bg-blue-100 text-blue-700', icon: 'f' },
  instagram: { label: 'Instagram', color: 'bg-pink-100 text-pink-700', icon: '◎' },
  tiktok: { label: 'TikTok', color: 'bg-slate-900 text-white', icon: '♪' },
  telegram: { label: 'Telegram', color: 'bg-sky-100 text-sky-700', icon: '✈' },
};

export default function KHSMMServices() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const items = await listProducts(user.shop_id);
        const filtered = (items || [])
          .filter((item) => item?.metadata?.fulfillment_type === 'manual_service')
          .sort((a, b) => Number(a.price || 0) - Number(b.price || 0));

        setServices(filtered);
        setSelectedId(filtered[0]?.id || null);
      } catch (err) {
        toast.error(err?.response?.data?.detail || 'មិនអាចបើកសេវាកម្មធ្វើដោយដៃបាន');
      } finally {
        setLoading(false);
      }
    };

    if (user?.shop_id) load();
  }, [user?.shop_id]);

  const selected = useMemo(
    () => services.find((item) => item.id === selectedId) || services[0] || null,
    [services, selectedId]
  );

  if (loading) return <Loading />;
  if (!services.length) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p>មិនទាន់មានសេវាកម្មធ្វើដោយដៃទេ។ បង្កើតផលិតផល TikTok/Facebook/Instagram/YouTube មុនសិន។</p>
        <Link to="/products/new" className={btnPrimary + ' mt-4 inline-flex items-center gap-2'}><FiPlusCircle /> បង្កើតសេវាកម្មថ្មី</Link>
      </div>
    );
  }

  const platform = selected?.metadata?.service_platform || 'facebook';
  const platformData = PLATFORM_META[platform] || PLATFORM_META.facebook;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-indigo-600 font-semibold">ROVISTAR SERVICES</p>
          <h1 className="text-3xl font-bold mt-1">សេវាកម្មប៊ូតដោយដៃ</h1>
        </div>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
          <FiCheckCircle /> បង់ប្រាក់រួច
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-6">
        <div className="space-y-4">
          {services.map((item) => {
            const itemPlatform = (item.metadata?.service_platform || 'facebook').toLowerCase();
            const itemMeta = PLATFORM_META[itemPlatform] || PLATFORM_META.facebook;
            const image = item.images?.[0] ? fullUrl(item.images[0]) : '';
            const isSelected = selected?.id === item.id;

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left rounded-2xl border bg-white p-4 shadow-sm transition ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'}`}
              >
                <div className="flex gap-4 items-center">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                    {image ? (
                      <img src={image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center text-2xl font-bold ${itemMeta.color}`}>
                        {itemMeta.icon}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${itemMeta.color}`}>
                        {itemMeta.label}
                      </span>
                      <span className="text-xs font-semibold text-amber-700">សេវាកម្មដាច់ដោយឡែក</span>
                    </div>
                    <h2 className="mt-2 font-bold text-lg truncate">{item.name}</h2>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.description || 'សេវាកម្មដែលភ្ញៀវដាក់ Link មុនបង់ ហើយអ្នកគ្រប់គ្រងដោយដៃ'}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xl font-bold text-slate-900">${Number(item.price || 0).toFixed(2)}</span>
                      <span className="text-xs text-indigo-600 font-semibold">{item.metadata?.service_type || 'សេវាកម្ម'}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ${platformData.color}`}>
                  {platformData.label}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                  <FiTag /> រួចរាល់សម្រាប់ទទួល order
                </span>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border bg-slate-50">
                {selected.images?.[0] ? (
                  <img src={fullUrl(selected.images[0])} alt={selected.name} className="w-full h-56 object-cover" />
                ) : (
                  <div className={`h-56 flex items-center justify-center text-5xl font-bold ${platformData.color}`}>
                    {platformData.icon}
                  </div>
                )}
              </div>

              <h2 className="mt-5 text-2xl font-bold">{selected.name}</h2>
              <p className="mt-2 text-slate-600">{selected.description || 'ភ្ញៀវជ្រើស package និងបញ្ចូល public link មុនទូទាត់ប្រាក់។'}</p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-slate-500">តម្លៃចាប់ផ្ដើម</div>
                  <div className="mt-1 font-bold text-lg">${Number(selected.price || 0).toFixed(2)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-slate-500">Platform</div>
                  <div className="mt-1 font-bold">{platformData.label}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-slate-500">ប្រភេទសេវាកម្ម</div>
                  <div className="mt-1 font-bold capitalize">{selected.metadata?.service_type || 'ទូទៅ'}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-slate-500">ការផ្ដល់សេវា</div>
                  <div className="mt-1 font-bold">Link មុនបង់</div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                <h3 className="flex items-center gap-2 font-bold text-indigo-950"><FiPackage /> ប្រអប់ Package និងតម្លៃ</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(selected.variations || []).map((variation, index) => (
                    <div key={index} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                      <strong>{Object.values(variation.attrs || {}).join(' · ') || `Package ${index + 1}`}</strong>
                      <span className="mt-1 block text-indigo-700">${Number(variation.price || 0).toFixed(2)}</span>
                    </div>
                  ))}
                  {(!selected.variations || selected.variations.length === 0) && <p className="text-sm text-slate-500">មិនទាន់មាន package ទេ។ ចូលកែផលិតផលនេះ ដើម្បីបន្ថែម package និងតម្លៃ។</p>}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
