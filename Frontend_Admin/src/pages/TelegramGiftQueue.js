import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiCheck,
  FiCheckSquare,
  FiExternalLink,
  FiGift,
  FiSend,
  FiSquare,
} from 'react-icons/fi';
import {
  createTelegramGiftQueue,
  listShops,
  listTelegramGiftQueue,
  publishTelegramGift,
} from '../api';
import { Empty, Loading, btnPrimary, inputCls } from '../components/ui';

const TELEGRAM_GIFT_URL = /^https?:\/\/(?:www\.)?t\.me\/nft\/[A-Za-z][A-Za-z0-9]*-\d+\/?$/i;

const getErrorMessage = (error, fallback) => error?.response?.data?.detail || fallback;

export default function TelegramGiftQueue() {
  const [shops, setShops] = useState([]);
  const [shopId, setShopId] = useState('');
  const [links, setLinks] = useState('');
  const [price, setPrice] = useState('');
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    listShops()
      .then(setShops)
      .catch((error) => toast.error(getErrorMessage(error, 'Could not load shops')))
      .finally(() => setLoadingShops(false));
  }, []);

  const loadQueue = useCallback(async () => {
    if (!shopId) {
      setItems([]);
      setSelectedIds([]);
      return;
    }

    setLoadingQueue(true);
    try {
      const queue = await listTelegramGiftQueue(Number(shopId));
      setItems(queue);
      setSelectedIds((current) => current.filter((id) => queue.some((item) => item.id === id && item.status !== 'published')));
    } catch (error) {
      setItems([]);
      setSelectedIds([]);
      toast.error(getErrorMessage(error, 'Could not load the Telegram Gift Queue'));
    } finally {
      setLoadingQueue(false);
    }
  }, [shopId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const queuedItems = useMemo(() => items.filter((item) => item.status !== 'published'), [items]);
  const selectedShop = shops.find((shop) => String(shop.id) === shopId);
  const allQueuedSelected = queuedItems.length > 0 && queuedItems.every((item) => selectedIds.includes(item.id));

  const queueLinks = async (event) => {
    event.preventDefault();
    if (!shopId) {
      toast.error('Select a target shop first');
      return;
    }

    const urls = [...new Set(links.split(/[\n,]/).map((value) => value.trim()).filter(Boolean))];
    const invalidUrls = urls.filter((url) => !TELEGRAM_GIFT_URL.test(url));
    const usd = Number(price);

    if (!urls.length) {
      toast.error('Paste at least one t.me/nft link');
      return;
    }
    if (invalidUrls.length) {
      toast.error(`Use full t.me/nft links (${invalidUrls.length} invalid)`);
      return;
    }
    if (!Number.isFinite(usd) || usd <= 0) {
      toast.error('Enter a valid USD price');
      return;
    }

    setQueueing(true);
    const results = await Promise.allSettled(
      urls.map((url) => createTelegramGiftQueue({ shop_id: Number(shopId), url, price: usd }))
    );
    const successes = results.filter((result) => result.status === 'fulfilled').length;
    const failure = results.find((result) => result.status === 'rejected');

    if (successes) {
      toast.success(`${successes} gift preview${successes === 1 ? '' : 's'} queued for ${selectedShop?.shop_name || selectedShop?.username}`);
      setLinks('');
      await loadQueue();
    }
    if (failure) {
      toast.error(getErrorMessage(failure.reason, `${results.length - successes} gift link${results.length - successes === 1 ? '' : 's'} could not be queued`));
    }
    setQueueing(false);
  };

  const toggleSelected = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  };

  const toggleAllQueued = () => {
    setSelectedIds(allQueuedSelected ? [] : queuedItems.map((item) => item.id));
  };

  const updateItemPrice = (id, value) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, price: value } : item));
  };

  const publishSelected = async () => {
    const selectedItems = items.filter((item) => selectedIds.includes(item.id) && item.status !== 'published');
    if (!selectedItems.length) {
      toast.error('Select at least one queued gift');
      return;
    }

    const invalidPrice = selectedItems.some((item) => !Number.isFinite(Number(item.price)) || Number(item.price) <= 0);
    if (invalidPrice) {
      toast.error('Every selected gift needs a valid USD price');
      return;
    }

    setPublishing(true);
    const results = await Promise.allSettled(selectedItems.map((item) => publishTelegramGift(item.id, {
      price: Number(item.price),
      name: item.title,
      description: item.description || '',
    })));
    const successes = results.filter((result) => result.status === 'fulfilled').length;
    const failure = results.find((result) => result.status === 'rejected');

    if (successes) {
      toast.success(`${successes} gift${successes === 1 ? '' : 's'} published to ${selectedShop?.shop_name || selectedShop?.username}`);
      await loadQueue();
    }
    if (failure) {
      toast.error(getErrorMessage(failure.reason, `${results.length - successes} selected gift${results.length - successes === 1 ? '' : 's'} could not be published`));
    }
    setPublishing(false);
  };

  if (loadingShops) return <Loading />;

  return (
    <div className="max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
            <FiGift /> Collectible publishing
          </div>
          <h1 className="text-3xl font-bold text-slate-950">Telegram Gift Queue</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Fetch public previews from t.me, review the price, then publish selected gifts as products in a target shop.
          </p>
        </div>
        <label className="w-full text-sm font-semibold text-slate-700 lg:w-80">
          Target shop
          <select
            className={`${inputCls} mt-1 bg-white`}
            value={shopId}
            onChange={(event) => setShopId(event.target.value)}
          >
            <option value="">Select a shop</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.shop_name || shop.username} (@{shop.username})
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-950 px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Step 1</p>
          <h2 className="mt-1 text-lg font-bold">Queue public previews</h2>
          <p className="mt-1 text-sm text-slate-300">One link per line. The assigned USD price applies to every link in this batch.</p>
        </div>
        <form onSubmit={queueLinks} className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
          <label className="text-sm font-semibold text-slate-700">
            Telegram collectible links
            <textarea
              className={`${inputCls} mt-1 min-h-28 resize-y font-mono`}
              value={links}
              onChange={(event) => setLinks(event.target.value)}
              placeholder={'https://t.me/nft/ChillFlame-13081\nhttps://t.me/nft/ChillFlame-193691'}
              disabled={queueing}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Price per gift (USD)
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-bold text-slate-400">$</span>
              <input
                className={`${inputCls} pl-7`}
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
                disabled={queueing}
              />
            </div>
          </label>
          <button className={`${btnPrimary} inline-flex min-h-10 items-center justify-center gap-2`} disabled={queueing || !shopId}>
            <FiSend /> {queueing ? 'Fetching previews...' : 'Queue previews'}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Step 2</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Review and publish</h2>
          </div>
          {shopId && queuedItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" onClick={toggleAllQueued}>
                {allQueuedSelected ? <FiCheckSquare /> : <FiSquare />}
                {allQueuedSelected ? 'Clear selection' : 'Select all queued'}
              </button>
              <button className={`${btnPrimary} inline-flex items-center gap-2`} onClick={publishSelected} disabled={publishing || selectedIds.length === 0}>
                <FiSend /> {publishing ? 'Publishing...' : `Publish selected (${selectedIds.length})`}
              </button>
            </div>
          )}
        </div>

        {!shopId ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white"><Empty message="Select a target shop to view its gift queue." /></div>
        ) : loadingQueue ? (
          <div className="rounded-2xl bg-white"><Loading /></div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white"><Empty message="No gift previews queued for this shop yet." /></div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const published = item.status === 'published';
              const selected = selectedIds.includes(item.id);
              return (
                <article key={item.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${selected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                    <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${published ? 'bg-emerald-500 text-white' : 'bg-slate-950 text-white'}`}>
                      {published ? 'Published' : 'Queued'}
                    </span>
                    {!published && (
                      <button
                        type="button"
                        onClick={() => toggleSelected(item.id)}
                        className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl border text-xl shadow-lg transition ${selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-white bg-white text-slate-500 hover:text-indigo-600'}`}
                        aria-label={`${selected ? 'Deselect' : 'Select'} ${item.title}`}
                      >
                        {selected ? <FiCheckSquare /> : <FiSquare />}
                      </button>
                    )}
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{item.collection} #{item.gift_number}</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-950">{item.title}</h3>
                      <p className="mt-2 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-slate-500">{item.description || 'No public description provided by Telegram.'}</p>
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        USD price
                        <div className="relative mt-1 w-32">
                          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-bold text-slate-400">$</span>
                          <input
                            className={`${inputCls} pl-7 font-bold`}
                            type="number"
                            min="0.01"
                            max="1000000"
                            step="0.01"
                            value={item.price}
                            onChange={(event) => updateItemPrice(item.id, event.target.value)}
                            disabled={published || publishing}
                          />
                        </div>
                      </label>
                      <a href={item.canonical_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                        Open t.me <FiExternalLink />
                      </a>
                    </div>
                    {published && (
                      <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        <FiCheck /> Product #{item.product_id} is live in the shop
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
