import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBookmark, FiHeart, FiMessageCircle, FiSend, FiShare2 } from 'react-icons/fi';
import { addAnnouncementComment, fullUrl, getAnnouncements, getSavedAnnouncements, toggleAnnouncementLike, toggleAnnouncementSave } from '../api';
import { useCustomer } from '../contexts/CustomerContext';
import { useShop } from '../contexts/ShopContext';

export default function InformationFeed({ savedOnly = false }) {
  const { shop } = useShop();
  const { isLoggedIn, token } = useCustomer();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const load = () => (savedOnly && isLoggedIn ? getSavedAnnouncements(token) : getAnnouncements())
    .then(setPosts).catch(() => setPosts([])).finally(() => setLoading(false));
  useEffect(() => { load(); }, [savedOnly, isLoggedIn, token]);
  if (shop.username?.toLowerCase() !== 'rovistar') return null;
  const requireLogin = () => { if (!isLoggedIn) { toast('សូមចូលគណនីសិន ដើម្បីប្រើមុខងារនេះ'); return false; } return true; };
  const update = (id, changes) => setPosts((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item));
  const like = async (post) => { if (!requireLogin()) return; try { const data = await toggleAnnouncementLike(post.id, token); update(post.id, data); } catch (_) { toast.error('មិនអាច Like បានទេ'); } };
  const save = async (post) => { if (!requireLogin()) return; try { const data = await toggleAnnouncementSave(post.id, token); if (savedOnly && !data.saved) setPosts((items) => items.filter((item) => item.id !== post.id)); else update(post.id, data); } catch (_) { toast.error('មិនអាចរក្សាទុកបានទេ'); } };
  const comment = async (post) => { if (!requireLogin() || !drafts[post.id]?.trim()) return; try { const row = await addAnnouncementComment(post.id, drafts[post.id], token); update(post.id, { comments: [...(post.comments || []), row] }); setDrafts({ ...drafts, [post.id]: '' }); } catch (_) { toast.error('មិនអាចបញ្ចេញមតិបានទេ'); } };
  const share = async (post) => { const url = window.location.href; try { if (navigator.share) await navigator.share({ title: post.title, text: post.content, url }); else { await navigator.clipboard.writeText(url); toast.success('បានចម្លងលីងរួច'); } } catch (_) {} };
  return <section className="important-feed"><div className="important-feed-heading"><div><span>ROVISTAR UPDATE</span><h1>{savedOnly ? 'ព័ត៌មានដែលអ្នកបានរក្សាទុក' : 'ព័ត៌មានសំខាន់ៗ'}</h1><p>{savedOnly ? 'មើលព័ត៌មានដែលអ្នកចង់តាមដានម្ដងទៀត' : 'ដំណឹងថ្មីៗ ការផ្តល់ជូន និងព័ត៌មានពី Rovistar'}</p></div><Link to={`/${shop.username}`} className="important-back">ត្រឡប់ទៅហាង</Link></div>{loading ? <div className="important-empty">កំពុងផ្ទុកព័ត៌មាន...</div> : posts.length ? <div className="important-stack">{posts.map((post) => <article className="important-card" key={post.id}>{post.image_url && <img className="important-media" src={fullUrl(post.image_url)} alt="" />}{post.video_url && <video className="important-media" controls playsInline src={fullUrl(post.video_url)} />}<div className="important-copy"><time>{new Date(post.created_at).toLocaleDateString()}</time><h2>{post.title}</h2><p>{post.content}</p></div><div className="important-actions"><button className={post.liked ? 'is-active' : ''} onClick={() => like(post)}><FiHeart /> {post.likes || 0}</button><button onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}><FiMessageCircle /> {post.comments?.length || 0}</button><button onClick={() => share(post)}><FiShare2 /> ចែករំលែក</button><button className={post.saved ? 'is-active' : ''} onClick={() => save(post)}><FiBookmark /> រក្សាទុក</button></div><div className="important-comments">{post.comments?.map((row) => <div key={row.id}><strong>{row.author}</strong><span>{row.content}</span></div>)}<div className="important-comment-box"><input id={`comment-${post.id}`} value={drafts[post.id] || ''} onChange={(e) => setDrafts({ ...drafts, [post.id]: e.target.value })} placeholder="សរសេរមតិរបស់អ្នក..." onKeyDown={(e) => { if (e.key === 'Enter') comment(post); }} /><button onClick={() => comment(post)} aria-label="Send comment"><FiSend /></button></div></div></article>)}</div> : <div className="important-empty">មិនទាន់មានព័ត៌មាននៅឡើយទេ។</div>}</section>;
}
