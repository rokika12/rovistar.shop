import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBookmark, FiHeart, FiMessageCircle, FiSend, FiShare2, FiX } from 'react-icons/fi';
import { addAnnouncementComment, fullUrl, getAnnouncements, getSavedAnnouncements, toggleAnnouncementLike, toggleAnnouncementSave } from '../api';
import { useCustomer } from '../contexts/CustomerContext';
import { useShop } from '../contexts/ShopContext';

export default function InformationFeed({ savedOnly = false }) {
  const { shop } = useShop();
  const { isLoggedIn, token } = useCustomer();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState('');
  const load = () => (savedOnly && isLoggedIn ? getSavedAnnouncements(token) : getAnnouncements())
    .then(setPosts).catch(() => setPosts([])).finally(() => setLoading(false));

  useEffect(() => { load(); }, [savedOnly, isLoggedIn, token]);
  if (shop.username?.toLowerCase() !== 'rovistar') return null;

  const requireLogin = () => {
    if (!isLoggedIn) { toast('សូមចូលគណនីសិន ដើម្បីប្រើមុខងារនេះ'); return false; }
    return true;
  };
  const update = (id, changes) => {
    setPosts((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item));
    setSelected((item) => item?.id === id ? { ...item, ...changes } : item);
  };
  const like = async (post) => {
    if (!requireLogin()) return;
    try { update(post.id, await toggleAnnouncementLike(post.id, token)); } catch (_) { toast.error('មិនអាច Like បានទេ'); }
  };
  const save = async (post) => {
    if (!requireLogin()) return;
    try {
      const result = await toggleAnnouncementSave(post.id, token);
      if (savedOnly && !result.saved) { setPosts((items) => items.filter((item) => item.id !== post.id)); setSelected(null); }
      else update(post.id, result);
    } catch (_) { toast.error('មិនអាចរក្សាទុកបានទេ'); }
  };
  const comment = async () => {
    if (!selected || !requireLogin() || !draft.trim()) return;
    try {
      const row = await addAnnouncementComment(selected.id, draft, token);
      update(selected.id, { comments: [...(selected.comments || []), row] });
      setDraft('');
    } catch (_) { toast.error('មិនអាចបញ្ចេញមតិបានទេ'); }
  };
  const share = async (post) => {
    try {
      const url = `${window.location.origin}${window.location.pathname}#news-${post.id}`;
      if (navigator.share) await navigator.share({ title: post.title, text: post.content, url });
      else { await navigator.clipboard.writeText(url); toast.success('បានចម្លងលីងរួច'); }
    } catch (_) {}
  };

  return (
    <section className="important-feed">
      <div className="important-feed-heading">
        <div><span>ROVISTAR UPDATE</span><h1>{savedOnly ? 'ព័ត៌មានដែលអ្នកបានរក្សាទុក' : 'ព័ត៌មានសំខាន់ៗ'}</h1><p>{savedOnly ? 'មើលព័ត៌មានដែលអ្នកចង់តាមដានម្ដងទៀត' : 'ដំណឹងថ្មីៗ ការផ្តល់ជូន និងព័ត៌មានពី Rovistar'}</p></div>
        <Link to={`/${shop.username}`} className="important-back">ត្រឡប់ទៅហាង</Link>
      </div>
      {loading ? <div className="important-empty">កំពុងផ្ទុកព័ត៌មាន...</div> : posts.length ? (
        <div className="important-grid">
          {posts.map((post) => <button type="button" className="important-preview" key={post.id} onClick={() => { setSelected(post); setDraft(''); }}>
            <div className="important-preview-media">{post.image_url ? <img src={fullUrl(post.image_url)} alt="" /> : post.video_url ? <video muted playsInline src={fullUrl(post.video_url)} /> : <span>ព័ត៌មាន</span>}</div>
            <div className="important-preview-copy"><time>{new Date(post.created_at).toLocaleDateString()}</time><h2>{post.title}</h2><p>{post.content}</p><b>មើលព័ត៌មាន →</b></div>
          </button>)}
        </div>
      ) : <div className="important-empty">មិនទាន់មានព័ត៌មាននៅឡើយទេ។</div>}
      {selected && <div className="important-modal" role="dialog" aria-modal="true" aria-label={selected.title} onMouseDown={() => setSelected(null)}>
        <article className="important-modal-card" onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" className="important-modal-close" onClick={() => setSelected(null)} aria-label="Close"><FiX /></button>
          {selected.image_url && <img className="important-modal-media" src={fullUrl(selected.image_url)} alt="" />}
          {selected.video_url && <video className="important-modal-media" controls playsInline src={fullUrl(selected.video_url)} />}
          <div className="important-copy"><time>{new Date(selected.created_at).toLocaleDateString()}</time><h2>{selected.title}</h2><p>{selected.content}</p></div>
          <div className="important-actions"><button className={selected.liked ? 'is-active' : ''} onClick={() => like(selected)}><FiHeart /> {selected.likes || 0}</button><button><FiMessageCircle /> {selected.comments?.length || 0}</button><button onClick={() => share(selected)}><FiShare2 /> ចែករំលែក</button><button className={selected.saved ? 'is-active' : ''} onClick={() => save(selected)}><FiBookmark /> រក្សាទុក</button></div>
          <div className="important-comments">{selected.comments?.map((row) => <div key={row.id}><strong>{row.author}</strong><span>{row.content}</span></div>)}<div className="important-comment-box"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="សរសេរមតិរបស់អ្នក..." onKeyDown={(event) => { if (event.key === 'Enter') comment(); }} /><button onClick={comment} aria-label="Send comment"><FiSend /></button></div></div>
        </article>
      </div>}
    </section>
  );
}
