import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiChevronLeft, FiPlayCircle, FiShoppingBag, FiZap } from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../i18n';
import { getProduct, getProducts, fullUrl, lookupRobloxUsername } from '../api';
import ProductCard from '../components/ProductCard';
import Loading from '../components/Loading';

export default function ProductDetail() {
  const { id } = useParams();
  const { shop } = useShop();
  const { addItem, clear, setOpen } = useCart();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariations, setSelectedVariations] = useState({});
  const [activeImage, setActiveImage] = useState(0);
  const [serviceLink, setServiceLink] = useState('');
  const [gameServerId, setGameServerId] = useState('');
  const [robloxAccount, setRobloxAccount] = useState(null);
  const [checkingRoblox, setCheckingRoblox] = useState(false);

  useEffect(() => {
    if (!shop) return;
    setLoading(true);
    Promise.all([getProduct(id), getProducts(shop.id)])
      .then(([prod, prods]) => {
        setProduct(prod);
        setRelated(prods.filter((p) => p.id !== prod.id && p.category_id === prod.category_id).slice(0, 4));
        // Seed empty selections for every selectable attribute
        // (variation attrs + custom select/color attributes with options).
        const initial = {};
        if (prod.variations && prod.variations.length > 0) {
          Object.keys(prod.variations[0].attrs || {}).forEach((a) => { initial[a] = ''; });
        }
        (prod.custom_attributes || [])
          .filter((a) => (a.type === 'select' || a.type === 'color') && (a.options || '').trim())
          .forEach((a) => { if (initial[a.name] === undefined) initial[a.name] = ''; });
        setSelectedVariations(initial);
      })
      .catch((e) => toast.error(e?.response?.data?.detail || 'Product not found'))
      .finally(() => setLoading(false));
  }, [id, shop]);

  const currentVariation = useMemo(() => {
    if (!product || !product.variations || product.variations.length === 0) return null;
    // Only match attributes that are actually part of the variations, so extra
    // selections like Color (not in stock matrix) never break price/stock lookup.
    const vkeys = Object.keys(product.variations[0].attrs || {});
    if (vkeys.length === 0) return null;
    return product.variations.find((v) =>
      vkeys.every((k) => selectedVariations[k] && v.attrs?.[k] === selectedVariations[k])
    ) || null;
  }, [product, selectedVariations]);

  const effectivePrice = currentVariation?.price ?? product?.sale_price ?? product?.price ?? 0;
  const effectiveStock = currentVariation?.quantity ?? product?.quantity ?? 0;

  if (loading) return <Loading />;
  if (!product) {
    return <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-400">Product not found.</div>;
  }

  const displayAttrs = (product.custom_attributes || []).filter((a) => !['select', 'color'].includes(a.type));
  const varAttrs = product.variations && product.variations.length > 0
    ? Object.keys(product.variations[0].attrs || {})
    : [];
  const varOptions = (attrName) => [...new Set((product.variations || []).map((v) => v.attrs?.[attrName]).filter(Boolean))];
  const manualService = product.metadata?.fulfillment_type === 'manual_service';
  const servicePlatform = String(product.metadata?.service_platform || '').toLowerCase();
  const telegramService = manualService && servicePlatform === 'telegram' && /premium|star/i.test(product.name || '');
  const freeFireService = manualService && servicePlatform === 'free_fire';
  const mobileLegendsService = manualService && servicePlatform === 'mobile_legends';
  const robloxService = manualService && servicePlatform === 'roblox';
  const isAvailable = manualService || effectiveStock > 0;
  const videoUrl = String(product.metadata?.service_video_url || '').trim();
  const youtubeMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  const isDirectVideo = /\.(mp4|webm)(?:\?.*)?$/i.test(videoUrl);

  // Unified list of attributes the customer can pick: custom select/color
  // attributes with options, plus any variation attributes not covered.
  const selectableAttrs = (() => {
    const list = [];
    const seen = new Set();
    for (const a of product.custom_attributes || []) {
      if ((a.type === 'select' || a.type === 'color') && (a.options || '').trim()) {
        const opts = a.options.split(',').map((o) => o.trim()).filter(Boolean);
        if (opts.length > 0) {
          list.push({ key: a.name || a.label, label: a.label || a.name, type: a.type, required: !!a.required, options: opts });
          seen.add(a.name);
        }
      }
    }
    for (const attr of varAttrs) {
      if (!seen.has(attr)) {
        const opts = varOptions(attr);
        if (opts.length > 0) list.push({ key: attr, label: attr, type: 'select', required: true, options: opts });
      }
    }
    return list;
  })();

  const buyNow = () => {
    const missing = selectableAttrs.find((a) => !selectedVariations[a.key]);
    if (missing) { toast.error(`Please select ${missing.label}`); return; }
    if (telegramService && !/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(serviceLink.trim())) {
      toast.error('Please enter a valid Telegram username starting with @');
      return;
    }
    if (manualService && !telegramService && !serviceLink.trim().startsWith(('https://'))) {
      if (freeFireService && /^\d{5,20}$/.test(serviceLink.trim())) {
        // Free Fire does not provide an official public player-name lookup API.
      } else if (mobileLegendsService && /^\d{5,20}$/.test(serviceLink.trim()) && /^\d{3,10}$/.test(gameServerId.trim())) {
        // Mobile Legends credentials are sent as a paired Game ID and Server ID.
      } else if (robloxService && robloxAccount) {
        // Only a verified official Roblox username can continue to checkout.
      } else {
        toast.error(freeFireService ? 'Please enter a valid Free Fire Player ID' : mobileLegendsService ? 'Enter valid Mobile Legends Game ID and Server ID' : robloxService ? 'Verify your Roblox username first' : 'Please enter your public TikTok link');
        return;
      }
    }
    if (robloxService && !robloxAccount) {
      toast.error('Verify your Roblox username first');
      return;
    }
    if (!isAvailable) { toast.error('This item is out of stock'); return; }
    // Buy now starts a single-product checkout instead of mixing older cart items.
    clear();
    const serviceTarget = mobileLegendsService
      ? `Mobile Legends Game ID: ${serviceLink.trim()} | Server ID: ${gameServerId.trim()}`
      : robloxService
        ? `Roblox: ${robloxAccount.username} (${robloxAccount.display_name}, ID ${robloxAccount.id})`
        : freeFireService
          ? `Free Fire Player ID: ${serviceLink.trim()}`
          : serviceLink.trim();
    addItem({ ...product, price: effectivePrice, sale_price: effectivePrice }, 1, manualService ? { ...selectedVariations, _service_link: serviceTarget } : selectedVariations);
    setOpen(false);
    navigate(`/${shop.username}/checkout`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4 text-sm">
        <FiChevronLeft /> {t('back')}
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Gallery */}
        <div>
          <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden">
            {product.images && product.images.length > 0 ? (
              <img src={fullUrl(product.images[activeImage])} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                <FiShoppingBag className="w-16 h-16" />
              </div>
            )}
          </div>
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${activeImage === i ? 'border-primary' : 'border-transparent'}`}
                >
                  <img src={fullUrl(img)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Purchase panel */}
        <div className="store-product-detail-panel">
          {product.category_name && <span className="text-xs text-primary font-semibold uppercase">{product.category_name}</span>}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-1">{product.name}</h1>
          {product.metadata?.product_type === 'digital' && product.metadata?.duration && (
            <span className="inline-block mt-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Digital access · {product.metadata.duration}
            </span>
          )}
          {manualService && (
            <p className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-900">{telegramService ? 'Choose a package and enter the recipient Telegram username before payment.' : freeFireService ? 'Enter your Free Fire Player ID before payment.' : mobileLegendsService ? 'Enter your Mobile Legends Game ID and Server ID before payment.' : robloxService ? 'Enter and verify your Roblox username before payment.' : 'Choose a package and paste your public TikTok link before payment. We never request your TikTok password.'}</p>
          )}

          {!manualService && (
            <div className="flex items-center gap-3 mt-4">
              <span className="text-3xl font-bold dark:text-gray-100">{effectivePrice.toFixed(2)}</span>
              <span className="text-gray-500 dark:text-gray-400">{shop.currency}</span>
              {product.sale_price != null && product.sale_price < product.price && (
                <span className="text-lg text-gray-400 dark:text-gray-500 line-through">{product.price.toFixed(2)}</span>
              )}
            </div>
          )}

          {manualService ? (
            <p className="text-sm text-green-600 mt-1">✓ Available · manual service</p>
          ) : effectiveStock > 0 ? (
            <p className="text-sm text-green-600 mt-1">✓ {t('inStock')} ({effectiveStock})</p>
          ) : (
            <p className="text-sm text-red-500 mt-1">✗ {t('outOfStock')}</p>
          )}

          {/* Selectable options — size, color, ... (clickable) */}
          {selectableAttrs.length > 0 && (
            <div className={`mt-6 space-y-4 ${manualService ? 'service-package-selector' : ''}`}>
              {selectableAttrs.map((attr) => (
                <div key={attr.key}>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                    {attr.label}{attr.required ? ' *' : ''}
                  </label>
                  <div className={`flex flex-wrap gap-2 ${manualService ? 'service-package-options' : ''}`}>
                    {attr.options.map((opt) => {
                      const optionPrice = manualService
                        ? product.variations.find((variation) => variation.attrs?.[attr.key] === opt)?.price
                        : null;
                      return attr.type === 'color' ? (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedVariations((prev) => ({ ...prev, [attr.key]: opt }))}
                          className="flex flex-col items-center gap-1 group"
                          title={opt}
                        >
                          <span
                            className={`w-10 h-10 rounded-full border-2 shadow-inner transition ${
                              selectedVariations[attr.key] === opt
                                ? 'border-primary ring-2 ring-primary/30'
                                : 'border-gray-200 group-hover:border-gray-400 dark:border-gray-600'
                            }`}
                            style={{ backgroundColor: opt.toLowerCase() }}
                          />
                          <span className={`text-xs ${selectedVariations[attr.key] === opt ? 'text-primary font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                            {opt}
                          </span>
                        </button>
                      ) : (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedVariations((prev) => ({ ...prev, [attr.key]: opt }))}
                          className={`${manualService ? 'service-package-option' : 'px-4 py-2 rounded-lg'} border-2 text-sm font-medium transition ${
                            selectedVariations[attr.key] === opt
                              ? 'border-primary bg-primary text-white'
                              : 'border-gray-200 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300'
                          }`}
                        >
                          <span>{opt}</span>
                          {manualService && optionPrice != null && <small>{Number(optionPrice).toFixed(2)} {shop.currency}</small>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {manualService && (
            <div className="service-link-card mt-5">
              <label htmlFor="service-link" className="block text-sm font-bold text-slate-900">{telegramService ? 'Telegram username' : freeFireService ? 'Free Fire Player ID' : mobileLegendsService ? 'Mobile Legends Game ID' : robloxService ? 'Roblox username' : 'TikTok link'}</label>
              <p>{telegramService ? 'Enter the recipient username, for example @username.' : freeFireService ? 'Free Fire is securely handled with Player ID only.' : mobileLegendsService ? 'Enter both numbers exactly as shown in your game profile.' : robloxService ? 'We will verify the public Roblox account name and avatar.' : 'Paste the public video or profile link before payment.'}</p>
              <input
                id="service-link"
                value={serviceLink}
                onChange={(event) => { setServiceLink(event.target.value); if (robloxService) setRobloxAccount(null); }}
                type="text"
                inputMode={freeFireService || mobileLegendsService ? 'numeric' : 'text'}
                placeholder={telegramService ? '@username' : freeFireService ? 'Player ID' : mobileLegendsService ? 'Game ID' : robloxService ? 'Username' : 'https://www.tiktok.com/@...'}
              />
              {mobileLegendsService && <input value={gameServerId} onChange={(event) => setGameServerId(event.target.value)} type="text" inputMode="numeric" placeholder="Server ID" className="mt-3" />}
              {robloxService && <>
                <button type="button" className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={checkingRoblox || !serviceLink.trim()} onClick={async () => {
                  setCheckingRoblox(true);
                  try { setRobloxAccount(await lookupRobloxUsername(serviceLink.trim())); }
                  catch (error) { setRobloxAccount(null); toast.error(error?.response?.data?.detail || 'Roblox username was not found'); }
                  finally { setCheckingRoblox(false); }
                }}>{checkingRoblox ? 'Checking...' : 'Verify Roblox account'}</button>
                {robloxAccount && <div className="mt-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{robloxAccount.avatar_url && <img src={robloxAccount.avatar_url} alt="Roblox avatar" className="h-11 w-11 rounded-full" />}<span><strong>{robloxAccount.display_name}</strong><br />@{robloxAccount.username} · Roblox ID {robloxAccount.id}</span></div>}
              </>}
            </div>
          )}

          {/* Direct digital purchase */}
          <div className="flex items-center gap-4 mt-8">
            <button onClick={buyNow} disabled={!isAvailable} className="flex-1 px-5 py-3 rounded-xl bg-primary text-white font-bold hover:brightness-95 disabled:opacity-50 flex items-center justify-center gap-2">
              <FiZap /> {manualService ? 'Continue' : 'Buy Now'}
            </button>
          </div>

          {/* Custom attributes */}
          {displayAttrs.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <h3 className="font-bold mb-3">{t('productDetails')}</h3>
              <dl className="space-y-2">
                {displayAttrs.map((a) => (
                  <div key={a.name} className="flex justify-between text-sm">
                    <dt className="text-gray-500 dark:text-gray-400">{a.label || a.name}:</dt>
                    <dd className="font-medium">{a.value || (a.options ? a.options.split(',').join(', ') : '—')}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div className="mt-6 border-t pt-6">
              <h3 className="font-bold mb-2">{t('description')}</h3>
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-line text-sm leading-relaxed">{product.description}</p>
            </div>
          )}
          {videoUrl && !manualService && (
            <div className="mt-6 border-t pt-6">
              <h3 className="mb-3 flex items-center gap-2 font-bold"><FiPlayCircle /> How it works</h3>
              {youtubeMatch ? (
                <div className="aspect-video overflow-hidden rounded-xl bg-slate-900">
                  <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${youtubeMatch[1]}`} title={`${product.name} guide`} allowFullScreen />
                </div>
              ) : isDirectVideo ? (
                <video className="w-full rounded-xl bg-slate-900" controls preload="metadata" src={fullUrl(videoUrl)} />
              ) : (
                <a className="inline-flex rounded-xl border-2 border-primary px-4 py-2 font-semibold text-primary" href={videoUrl} target="_blank" rel="noreferrer">Watch the service guide</a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-bold mb-6 dark:text-gray-100">{t('relatedProducts')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
