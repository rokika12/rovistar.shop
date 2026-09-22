import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiTrash2, FiUpload, FiVideo } from 'react-icons/fi';
import { createProduct, getProduct, getShopDetail, listCategories, updateProduct, uploadImages, uploadServiceVideo, fullUrl } from '../api';
import { useAuth } from '../contexts/AuthContext';
import AttributeBuilder from '../components/AttributeBuilder';
import VariationBuilder from '../components/VariationBuilder';
import { btnGhost, btnPrimary, inputCls } from '../components/ui';

const emptyProduct = {
  name: '', description: '', price: 0, sale_price: '', quantity: 0,
  category_id: '', images: [], custom_attributes: [], variations: [], featured: false, status: 'active',
  metadata: { product_type: 'physical', fulfillment_type: 'instant_code', service_video_url: '', is_khsmm_service: false, service_platform: '', service_type: '', api_package_id: '', service_url: 'https://khmer-smm.com/', digital_delivery: { credentials: [] } },
};

const emptyCredential = { email: '', password: '', license_key: '' };

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(emptyProduct);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [storeType, setStoreType] = useState('clothing');
  const isEdit = !!id;

  useEffect(() => {
    listCategories(user.shop_id).then(setCategories);
    getShopDetail(user.shop_id).then((shop) => setStoreType(shop.store_type || 'clothing'));
    if (isEdit) {
      getProduct(id).then((p) => {
        setForm({
          name: p.name, description: p.description, price: p.price,
          sale_price: p.sale_price ?? '', quantity: p.quantity,
          category_id: p.category_id ?? '', images: p.images || [],
          custom_attributes: p.custom_attributes || [], variations: p.variations || [],
          featured: p.featured, status: p.status,
          metadata: {
            product_type: p.metadata?.product_type || 'physical',
            fulfillment_type: p.metadata?.fulfillment_type || 'instant_code',
            service_video_url: p.metadata?.service_video_url || '',
            is_khsmm_service: !!p.metadata?.is_khsmm_service,
            service_platform: p.metadata?.service_platform || '',
            service_type: p.metadata?.service_type || '',
            api_package_id: p.metadata?.api_package_id || '',
            service_url: p.metadata?.service_url || 'https://khmer-smm.com/',
            digital_delivery: p.metadata?.digital_delivery || { credentials: [] },
          },
        });
      });
    }
  }, [id, isEdit, user.shop_id]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      const res = await uploadImages(files);
      setForm({ ...form, images: [...form.images, ...res.urls] });
      toast.success('Images uploaded');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Upload failed');
    }
    e.target.value = '';
  };

  const removeImage = (idx) => {
    setForm({ ...form, images: form.images.filter((_, i) => i !== idx) });
  };

  const handleServiceVideo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const result = await uploadServiceVideo(file);
      setForm({ ...form, metadata: { ...form.metadata, service_video_url: result.url } });
      toast.success('វីដេអូបានបញ្ចូលរួច');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'មិនអាចបញ្ចូលវីដេអូបាន');
    } finally {
      setUploadingVideo(false);
      event.target.value = '';
    }
  };

  const credentials = form.metadata?.digital_delivery?.credentials || [];
  const manualService = storeType === 'digital' && form.metadata?.fulfillment_type === 'manual_service';
  const primaryButton = storeType === 'digital'
    ? 'bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50'
    : btnPrimary;
  const setCredential = (index, field, value) => setForm({
    ...form,
    metadata: {
      ...form.metadata,
      digital_delivery: {
        ...(form.metadata?.digital_delivery || {}),
        credentials: credentials.map((entry, i) => i === index ? { ...entry, [field]: value } : entry),
      },
    },
  });

  const addCredential = () => setForm({
    ...form,
    metadata: {
      ...form.metadata,
      digital_delivery: {
        ...(form.metadata?.digital_delivery || {}),
        credentials: [...credentials, { ...emptyCredential }],
      },
    },
  });

  const removeCredential = (index) => setForm({
    ...form,
    metadata: {
      ...form.metadata,
      digital_delivery: {
        ...(form.metadata?.digital_delivery || {}),
        credentials: credentials.filter((_, i) => i !== index),
      },
    },
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    setSaving(true);
    const digitalCredentials = credentials.filter((entry) => entry.email || entry.password || entry.license_key);
    const metadata = {
      ...(form.metadata || {}),
      product_type: storeType === 'digital' ? 'digital' : 'physical',
      fulfillment_type: storeType === 'digital' && manualService ? 'manual_service' : 'instant_code',
      service_video_url: (form.metadata?.service_video_url || '').trim(),
      is_khsmm_service: storeType === 'digital' && !!form.metadata?.is_khsmm_service,
      service_platform: form.metadata?.service_platform || '',
      service_type: form.metadata?.service_type || '',
      api_package_id: form.metadata?.api_package_id || '',
      service_url: form.metadata?.service_url || 'https://khmer-smm.com/',
    };
    if (storeType === 'digital' && !manualService) {
      metadata.digital_delivery = { ...(form.metadata?.digital_delivery || {}), credentials: digitalCredentials };
    } else {
      delete metadata.digital_delivery;
      if (storeType !== 'digital') metadata.is_khsmm_service = false;
    }

    const payload = {
      shop_id: user.shop_id,
      name: form.name, description: form.description,
      price: Number(form.price) || 0,
      sale_price: form.sale_price === '' || form.sale_price === null ? null : Number(form.sale_price),
      quantity: storeType === 'digital' && !manualService ? digitalCredentials.length : Number(form.quantity) || 0,
      category_id: form.category_id === '' ? null : Number(form.category_id),
      images: form.images,
      custom_attributes: form.custom_attributes.filter((a) => a.name.trim()),
      variations: form.variations.map((v) => ({ ...v, price: Number(v.price) || 0, quantity: Number(v.quantity) || 0 })),
      featured: form.featured, status: form.status,
      metadata,
    };
    try {
      if (isEdit) { await updateProduct(id, payload); toast.success('Product updated!'); }
      else { await createProduct(payload); toast.success('Product created!'); }
      navigate('/products');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'កែសម្រួលផលិតផល' : 'បន្ថែមផលិតផលថ្មី'}</h1>
      <form onSubmit={submit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-bold">ព័ត៌មានមូលដ្ឋាន</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block">ឈ្មោះផលិតផល *</label>
            <input value={form.name} onChange={set('name')} className={inputCls} placeholder="ឧទាហរណ៍: ខោអាវក្រោយសំរាប់ប្រុស" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block">ការពិពណ៌នា</label>
            <textarea value={form.description} onChange={set('description')} rows="4" className={inputCls} placeholder="ពិពណ៌នាផលិតផលរបស់អ្នក..." />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block">តម្លៃ *</label>
              <input type="number" step="0.01" value={form.price} onChange={set('price')} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block">តម្លៃបញ្ចុះ</label>
              <input type="number" step="0.01" value={form.sale_price} onChange={set('sale_price')} className={inputCls} placeholder="ស្រេចចិត្ត" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block">ចំនួន</label>
              {storeType === 'digital' && !manualService ? (
                <div className={`${inputCls} bg-slate-50 text-slate-500`}>{credentials.length} credentials available</div>
              ) : (
                <input type="number" value={form.quantity} onChange={set('quantity')} className={inputCls} />
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block">ប្រភេទ</label>
              <select value={form.category_id} onChange={set('category_id')} className={inputCls}>
                <option value="">គ្មានប្រភេទ</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">រូបភាពផលិតផល</h2>
            <label className="flex items-center gap-1 text-indigo-600 text-sm font-semibold cursor-pointer hover:underline">
              <FiUpload /> បញ្ចូលរូបភាព
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleImages} />
            </label>
          </div>
          {form.images.length === 0 ? (
            <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4 text-center">មិនទាន់មានរូបភាព។ បញ្ចូលរូបភាពផលិតផលខាងលើ។</p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {form.images.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={fullUrl(img)} alt="" className="w-full aspect-square object-cover rounded-lg border" />
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-1.5 bg-white rounded-full shadow text-red-500 opacity-0 group-hover:opacity-100 transition">
                    <FiTrash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {storeType === 'digital' && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4 border border-cyan-100">
          <div>
            <h2 className="font-bold text-cyan-800">របៀបផ្ដល់សេវាកម្ម</h2>
            <p className="mt-1 text-xs text-gray-500">ជ្រើស “សេវាកម្មធ្វើដោយដៃ” សម្រាប់សេវាដែលអតិថិជនបង់រួច រួចផ្ញើ public link មកអ្នក។</p>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            ប្រភេទការផ្ដល់
            <select
              value={form.metadata?.fulfillment_type || 'instant_code'}
              onChange={(e) => setForm({ ...form, metadata: { ...form.metadata, fulfillment_type: e.target.value } })}
              className={inputCls}
            >
              <option value="instant_code">កូដ / License ភ្លាមៗ</option>
              <option value="manual_service">សេវាកម្មធ្វើដោយដៃ (អតិថិជនផ្ញើ Link ក្រោយបង់)</option>
            </select>
          </label>
          {manualService && (
            <>
              <p className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-900">ក្រោយពេលបង់ប្រាក់ អតិថិជននឹងបញ្ចូល TikTok/video/profile link នៅលើ receipt។ Website បញ្ជូន link នោះទៅ Telegram របស់ហាង ហើយមិនបង្ហាញ password ឬ code ទេ។</p>
              <label className="block text-sm font-medium text-gray-700">
                Link វីដេអូណែនាំ (YouTube ឬ MP4 public)
                <input
                  value={form.metadata?.service_video_url || ''}
                  onChange={(e) => setForm({ ...form, metadata: { ...form.metadata, service_video_url: e.target.value } })}
                  className={inputCls}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </label>
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-cyan-300 bg-white px-3 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-50">
                <FiVideo /> {uploadingVideo ? 'កំពុងបញ្ចូលវីដេអូ...' : 'បញ្ចូលវីដេអូ MP4 / WebM'}
                <input type="file" accept="video/mp4,video/webm" className="hidden" disabled={uploadingVideo} onChange={handleServiceVideo} />
              </label>
              <p className="text-xs text-gray-500">វីដេអូត្រូវតែតូចជាង 25MB ហើយនឹងបង្ហាញឲ្យភ្ញៀវមើលក្រោយពេលបង់ប្រាក់។</p>
            </>
          )}
        </div>
        )}

        {storeType === 'digital' && !manualService && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4 border border-pink-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-pink-700">Digital credentials / codes</h2>
              <p className="text-xs text-gray-500 mt-1">Each row is one digital item. Paid orders receive one available row.</p>
            </div>
            <button type="button" onClick={addCredential} className="text-sm font-bold text-pink-600 hover:underline">+ Add credential</button>
          </div>
          {credentials.length === 0 && <p className="text-sm text-gray-400 bg-pink-50 rounded-lg p-3">Add email, password, or code rows for this product.</p>}
          {credentials.map((entry, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end rounded-lg bg-pink-50 p-3">
              <input value={entry.email || ''} onChange={(e) => setCredential(index, 'email', e.target.value)} className={inputCls} placeholder="Email / username" />
              <input value={entry.password || ''} onChange={(e) => setCredential(index, 'password', e.target.value)} className={inputCls} placeholder="Password" />
              <input value={entry.license_key || ''} onChange={(e) => setCredential(index, 'license_key', e.target.value)} className={inputCls} placeholder="Code / license key" />
              <button type="button" onClick={() => removeCredential(index)} className="p-2 text-red-500 hover:bg-white rounded-lg" title="Remove credential"><FiTrash2 /></button>
            </div>
          ))}
        </div>
        )}

        {storeType === 'digital' && <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-bold">KHSMM Service Configuration</h2>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!form.metadata?.is_khsmm_service}
              onChange={(e) => setForm({ ...form, metadata: { ...form.metadata, is_khsmm_service: e.target.checked } })}
              className="w-4 h-4"
            />
            Mark as paid KHSMM service
          </label>

          {form.metadata?.is_khsmm_service && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block">Platform</label>
                <select
                  value={form.metadata?.service_platform || ''}
                  onChange={(e) => setForm({ ...form, metadata: { ...form.metadata, service_platform: e.target.value } })}
                  className={inputCls}
                >
                  <option value="">Select platform</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="telegram">Telegram</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block">Service Type</label>
                <input
                  value={form.metadata?.service_type || ''}
                  onChange={(e) => setForm({ ...form, metadata: { ...form.metadata, service_type: e.target.value } })}
                  className={inputCls}
                  placeholder="followers, likes, views, members"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block">API Package ID</label>
                <input
                  value={form.metadata?.api_package_id || ''}
                  onChange={(e) => setForm({ ...form, metadata: { ...form.metadata, api_package_id: e.target.value } })}
                  className={inputCls}
                  placeholder="e.g. 12345"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block">Service URL</label>
                <input
                  value={form.metadata?.service_url || 'https://khmer-smm.com/'}
                  onChange={(e) => setForm({ ...form, metadata: { ...form.metadata, service_url: e.target.value } })}
                  className={inputCls}
                  placeholder="https://khmer-smm.com/"
                />
              </div>
            </div>
          )}
        </div>}

        {storeType === 'clothing' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-blue-100">
            <h2 className="font-bold text-blue-700">Clothing store product</h2>
            <p className="text-sm text-gray-500 mt-1">This product uses physical stock and customer shipping details. Digital credentials are disabled for this shop.</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6">
          <AttributeBuilder attributes={form.custom_attributes} onChange={(v) => setForm({ ...form, custom_attributes: v })} />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <VariationBuilder variations={form.variations} onChange={(v) => setForm({ ...form, variations: v })} />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="w-4 h-4" />
              ផលិតផលពិសេស
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              ស្ថានភាព:
              <select value={form.status} onChange={set('status')} className="border rounded-lg px-2 py-1 text-sm">
                <option value="active">សកម្ម</option>
                <option value="hidden">លាក់</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? 'កំពុងរក្សាទុក...' : isEdit ? 'រក្សាទុកការផ្លាស់ប្តូរ' : 'បង្កើតផលិតផល'}
          </button>
          <button type="button" onClick={() => navigate('/products')} className={btnGhost}>បោះបង់</button>
        </div>
      </form>
    </div>
  );
}
