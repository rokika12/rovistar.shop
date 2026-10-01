import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiMessageCircle, FiSend } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { listShopSupportConversations, replyShopSupportConversation } from '../api';

export default function CustomerChat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');

  const refresh = async () => {
    const data = await listShopSupportConversations(user.shop_id);
    setConversations(data);
    setSelected((current) => data.find((item) => item.id === current?.id) || data[0] || null);
  };
  useEffect(() => {
    refresh().catch(() => toast.error('មិនអាចទាញសារ chat បាន'));
    const timer = setInterval(() => refresh().catch(() => {}), 8000);
    return () => clearInterval(timer);
  }, [user.shop_id]);
  const send = async (event) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    try {
      await replyShopSupportConversation(user.shop_id, selected.id, { body: reply.trim() });
      setReply('');
      await refresh();
    } catch (error) { toast.error(error.response?.data?.detail || 'មិនអាចផ្ញើសារបាន'); }
  };
  return <div className="max-w-6xl"><div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Customer Chat</h1><p className="text-sm text-slate-500">ឆ្លើយតបតែភ្ញៀវរបស់ហាងអ្នកប៉ុណ្ណោះ។</p></div><div className="bg-white border rounded-2xl grid md:grid-cols-[300px_1fr] min-h-[560px] overflow-hidden"><aside className="border-r bg-slate-50">{conversations.map((item) => <button key={item.id} onClick={() => setSelected(item)} className={`w-full p-4 text-left border-b ${selected?.id === item.id ? 'bg-white border-l-4 border-l-sky-500' : ''}`}><b className="block text-sm">{item.visitor_name || 'Visitor'}</b><span className="text-xs text-slate-500">{item.visitor_contact || 'No contact'}</span><p className="text-xs mt-2 truncate">{item.messages.at(-1)?.body}</p></button>)}{!conversations.length && <p className="p-5 text-sm text-slate-500">មិនទាន់មានសារ chat ទេ។</p>}</aside><section className="flex flex-col">{selected ? <><header className="p-5 border-b"><b>{selected.visitor_name || 'Visitor'}</b><span className="ml-2 text-sm text-slate-500">{selected.visitor_contact}</span></header><div className="flex-1 p-5 space-y-3 overflow-auto">{selected.messages.map((message) => <div key={message.id} className={`max-w-[80%] p-3 rounded-2xl text-sm ${message.sender === 'admin' ? 'ml-auto bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>{message.body}</div>)}</div><form onSubmit={send} className="p-4 border-t flex gap-2"><input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="សរសេរសារតបភ្ញៀវ..." className="flex-1 border rounded-xl px-4"/><button className="bg-sky-600 text-white p-3 rounded-xl" aria-label="Send"><FiSend /></button></form></> : <div className="m-auto text-center text-slate-400"><FiMessageCircle className="mx-auto text-4xl mb-3"/>ជ្រើសរើស chat មួយ</div>}</section></div></div>;
}
