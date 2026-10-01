import React, { useEffect, useState } from 'react';
import { FiMessageCircle, FiSend, FiX } from 'react-icons/fi';
import { getSupportConversation, openSupportConversation, sendSupportMessage } from '../api';
import { useShop } from '../contexts/ShopContext';

export default function SupportChat() {
  const { shop } = useShop();
  const [open, setOpen] = useState(false); const [token, setToken] = useState(''); const [data, setData] = useState(null);
  const [name, setName] = useState(''); const [contact, setContact] = useState(''); const [message, setMessage] = useState('');
  const key = `support_chat_${shop?.id}`;
  const refresh = async (currentToken) => { if (currentToken) setData(await getSupportConversation(currentToken)); };
  useEffect(() => { const saved = localStorage.getItem(key); if (saved) { setToken(saved); refresh(saved).catch(() => localStorage.removeItem(key)); } }, [key]);
  useEffect(() => { if (!token || !open) return undefined; const timer = setInterval(() => refresh(token).catch(() => {}), 7000); return () => clearInterval(timer); }, [token, open]);
  const submit = async (event) => { event.preventDefault(); if (!message.trim()) return; if (!token) { const result = await openSupportConversation({ shop_id: shop.id, visitor_name: name, visitor_contact: contact, message }); localStorage.setItem(key, result.token); setToken(result.token); setMessage(''); await refresh(result.token); } else { await sendSupportMessage(token, { body: message }); setMessage(''); await refresh(token); } };
  if (!shop) return null;
  return <div className="fixed z-[70] right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-6">
    {open && <div className="mb-3 w-[min(92vw,370px)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"><header className="bg-slate-900 text-white p-4 flex justify-between"><div><b>Chat with us</b><p className="text-xs text-slate-300">We reply in this chat.</p></div><button onClick={() => setOpen(false)}><FiX /></button></header><div className="h-72 overflow-auto p-4 space-y-3 bg-slate-50">{data?.messages?.map((item) => <div key={item.id} className={`max-w-[82%] text-sm p-3 rounded-2xl ${item.sender === 'admin' ? 'bg-slate-900 text-white ml-auto' : 'bg-white border text-slate-800'}`}>{item.body}</div>)}{!token && <p className="text-sm text-slate-500">Send your question and our team will reply here.</p>}</div><form onSubmit={submit} className="p-3 border-t space-y-2">{!token && <div className="grid grid-cols-2 gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="border rounded-lg px-3 py-2 text-sm"/><input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Telegram / phone" className="border rounded-lg px-3 py-2 text-sm"/></div>}<div className="flex gap-2"><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write a message..." className="flex-1 border rounded-lg px-3 py-2 text-sm"/><button className="bg-sky-600 text-white rounded-lg p-3"><FiSend /></button></div></form></div>}
    <button onClick={() => setOpen(!open)} className="w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center hover:bg-slate-700" aria-label="Open support chat"><FiMessageCircle className="w-6 h-6" /></button>
  </div>;
}
