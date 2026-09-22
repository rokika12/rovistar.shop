import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCopy, FiLink, FiMessageCircle, FiRefreshCw, FiSend } from 'react-icons/fi';
import { getTelegramSettings, resolveTelegramUsername, setTelegramWebhook, testTelegram, updateShop } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Loading, btnPrimary, btnGhost, inputCls } from '../components/ui';

export default function TelegramSettings() {
  const { user } = useAuth();
  const [tg, setTg] = useState({ bot_token: '', chat_id: '', admin_chat_id: '', enabled: false, bot_token_configured: false });
  const [profile, setProfile] = useState({ profile_id: '', secret_key: '', linked_chats: [], bot_username: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [publicUsername, setPublicUsername] = useState('');
  const [resolvedChat, setResolvedChat] = useState(null);
  const [resolvingUsername, setResolvingUsername] = useState(false);

  const load = () => {
    setLoading(true);
    getTelegramSettings(user.shop_id).then((st) => {
      setTg({
        bot_token: '',
        chat_id: st.chat_id ? String(st.chat_id) : '',
        admin_chat_id: st.admin_chat_ids?.[0] ? String(st.admin_chat_ids[0]) : '',
        enabled: st.enabled ?? false,
        bot_token_configured: st.bot_token_configured ?? false,
      });
      setProfile({
        profile_id: st.profile_id || '',
        secret_key: st.secret_key || '',
        linked_chats: st.linked_chats || [],
        bot_username: st.bot_username || '',
      });
    }).catch((err) => {
      toast.error(err?.response?.data?.detail || 'Failed to load Telegram settings');
    }).finally(() => setLoading(false));
  };

  useEffect(load, [user.shop_id]);

  const save = async () => {
    setSaving(true);
    try {
      await updateShop(user.shop_id, { telegram_settings: {
        bot_token: tg.bot_token.trim(),
        chat_id: tg.chat_id.trim(),
        admin_chat_ids: tg.admin_chat_id.trim() ? [tg.admin_chat_id.trim()] : [],
        enabled: tg.enabled,
      } });
      setTg((current) => ({ ...current, bot_token: '', bot_token_configured: true }));
      toast.success('Telegram settings saved!');
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (!await save()) return;
    try {
      const result = await testTelegram({
        shop_id: user.shop_id,
        message: '🧪 Test notification from Mini Shop Platform',
      });
      if (result.ok) toast.success(result.detail || 'Test notification sent!');
      else toast.error(result.detail || 'Test notification failed');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Test failed');
    }
  };

  const runWebhook = async () => {
    setWebhookBusy(true);
    try {
      await setTelegramWebhook(user.shop_id);
      toast.success('Webhook registered! You can now /start the bot and LINK this shop.');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'setWebhook failed');
    } finally {
      setWebhookBusy(false);
    }
  };

  const resolveUsername = async () => {
    setResolvingUsername(true);
    setResolvedChat(null);
    try {
      const result = await resolveTelegramUsername(user.shop_id, publicUsername);
      setResolvedChat(result);
      if (!result.ok) toast.error(result.detail);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not check that Telegram username');
    } finally {
      setResolvingUsername(false);
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  };

  if (loading) return <Loading />;

  const linkCommand = profile.profile_id && profile.secret_key
    ? `LINK ${profile.profile_id} ${profile.secret_key}`
    : '';

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Telegram Bot</h1>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className={btnPrimary}>{saving ? 'Saving...' : 'Save Settings'}</button>
          <button onClick={runTest} disabled={saving} className={btnGhost}><span className="inline-flex items-center gap-1"><FiSend /> Test</span></button>
        </div>
      </div>


      {/* Bot profile + chat linking */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2"><FiLink /> Link Your Shop to a Telegram Chat</h2>
          <button onClick={load} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <FiRefreshCw /> Refresh
          </button>
        </div>
        <p className="text-sm text-gray-500">
          The shop bot receives <b>order & payment notifications</b> in any chat that links to this shop.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="font-semibold text-sm">How to link your group (3 steps):</p>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>
              Add the bot to your group from Telegram:{' '}
              {profile.bot_username ? (
                <a href={`https://t.me/${profile.bot_username}`} target="_blank" rel="noreferrer"
                   className="text-sky-600 font-semibold hover:underline">
                  @{profile.bot_username}
                </a>
              ) : 'save the Bot Token below first, then refresh'}
            </li>
            <li>In that group, press <b>Start</b> (or send <code className="bg-slate-100 px-1 rounded">/start</code>).</li>
            <li>Send the command below in the group (or copy it):</li>
          </ol>

          {linkCommand ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-900 text-emerald-300 text-xs px-3 py-2 rounded-lg break-all">{linkCommand}</code>
              <button onClick={() => copy(linkCommand)} className="p-2 rounded-lg border hover:bg-white" title="Copy command">
                <FiCopy className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Profile ID / Secret Key will appear here once the bot token is saved.</p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            <div>
              <label className="text-xs font-semibold text-gray-500 block">Profile ID</label>
              <div className="flex items-center gap-1">
                <code className="flex-1 text-xs font-mono text-gray-700 bg-white border rounded px-2 py-1 truncate">{profile.profile_id || '—'}</code>
                {profile.profile_id && (
                  <button onClick={() => copy(profile.profile_id)} className="p-1.5 hover:bg-slate-100 rounded"><FiCopy className="w-3.5 h-3.5 text-gray-400" /></button>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block">Secret Key</label>
              <div className="flex items-center gap-1">
                <code className="flex-1 text-xs font-mono text-gray-700 bg-white border rounded px-2 py-1 truncate">{profile.secret_key || '—'}</code>
                {profile.secret_key && (
                  <button onClick={() => copy(profile.secret_key)} className="p-1.5 hover:bg-slate-100 rounded"><FiCopy className="w-3.5 h-3.5 text-gray-400" /></button>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <button onClick={runWebhook} disabled={webhookBusy} className={btnGhost}>
              {webhookBusy ? 'Registering...' : '🌐 Register Webhook (enables /start + LINK)'}
            </button>
            <p className="text-xs text-gray-400 mt-1">
              Required before any chat can link. Press it again after any update to re-register
              (also enables the bot to auto-reply with LINK instructions when added to a group).
            </p>
          </div>
        </div>

        {/* Linked chats */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Linked chats ({profile.linked_chats.length})</h3>
          {profile.linked_chats.length === 0 ? (
            <p className="text-xs text-gray-400">No chats linked yet. Follow the steps above to link the first one.</p>
          ) : (
            <ul className="space-y-1.5">
              {profile.linked_chats.map((cid) => (
                <li key={cid} className="flex items-center gap-2 text-sm bg-gray-50 border rounded-lg px-3 py-2">
                  <FiMessageCircle className="w-4 h-4 text-sky-500" />
                  <span className="font-mono">{cid}</span>
                  <span className="ml-auto text-xs text-emerald-600 font-semibold">● linked</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="font-bold">Payment & Order Alerts</h2>
        <p className="text-sm text-gray-500">
          Receive automatic notifications when a customer places an order or pays successfully.
          Create a bot with @BotFather and add it to your group to get the chat ID.
        </p>
        <div>
          <label className="text-sm font-medium text-gray-700 block">Bot Token</label>
          <input
            type="password"
            value={tg.bot_token}
            onChange={(e) => setTg({ ...tg, bot_token: e.target.value })}
            className={inputCls}
            placeholder={tg.bot_token_configured ? 'Token configured — leave blank to keep it' : '123456789:ABCdefGHI...'}
          />
          <p className="text-xs text-gray-400 mt-1">Create your bot with @BotFather. Saved tokens are never returned by the server.</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block">Chat ID (group / channel)</label>
          <input value={tg.chat_id} onChange={(e) => setTg({ ...tg, chat_id: e.target.value })} className={inputCls} placeholder="-1001234567890" />
          <p className="text-xs text-gray-400 mt-1">Negative IDs are supergroups; private chats use positive IDs.</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block">Admin 2 chat ID</label>
          <input value={tg.admin_chat_id} onChange={(e) => setTg({ ...tg, admin_chat_id: e.target.value })} className={inputCls} placeholder="Optional second admin chat ID" />
          <p className="text-xs text-gray-400 mt-1">Optional. This admin receives the same notifications as the primary chat.</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
          <label className="text-sm font-semibold text-slate-800 block">Check public Telegram username</label>
          <p className="text-xs text-slate-500 mt-1">Enter a public group or channel username to confirm its real Telegram name before using it.</p>
          <div className="mt-3 flex gap-2">
            <input value={publicUsername} onChange={(e) => setPublicUsername(e.target.value)} className={inputCls} placeholder="@my_shop_group" />
            <button type="button" onClick={resolveUsername} disabled={resolvingUsername || !publicUsername.trim()} className={btnGhost}>{resolvingUsername ? 'Checking...' : 'Check'}</button>
          </div>
          {resolvedChat && (
            <p className={`mt-3 text-sm font-semibold ${resolvedChat.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
              {resolvedChat.ok ? `✓ @${resolvedChat.username} — ${resolvedChat.name} (${resolvedChat.chat_type})` : resolvedChat.detail}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">Telegram does not let bots look up private people by username. A person must press Start on your bot first; then Telegram sends their real name and chat ID securely.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={tg.enabled} onChange={(e) => setTg({ ...tg, enabled: e.target.checked })} className="w-4 h-4" />
          Enable Telegram notifications
        </label>

        <div className="pt-3 border-t border-slate-200">
          <p className="text-xs text-gray-500">The Test button saves current settings first, then sends a notification using the existing Telegram test endpoint.</p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700">What gets sent:</p>
        <p>🛒 New order notification when a customer checks out.</p>
        <p>✅ Payment-success notification (with order number, amount, customer) once ABA Pay confirms.</p>
      </div>
    </div>
  );
}
