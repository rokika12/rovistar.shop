import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './ToolsHome.css';
import { FcGoogle } from 'react-icons/fc';
import { FaTelegramPlane } from 'react-icons/fa';
import {
  FiArrowRight, FiCheckCircle, FiCode, FiCopy, FiFileText, FiHeart, FiImage,
  FiLink, FiLock, FiLogIn, FiLogOut, FiMusic, FiPlay, FiSearch, FiSliders,
  FiUser, FiVideo, FiVolume2, FiX, FiZap,
} from 'react-icons/fi';
import { customerTelegramSignin, getShop } from '../api';
import TelegramLogin from '../components/TelegramLogin';
import { useCustomer } from '../contexts/CustomerContext';

const TOOLS = [
  { id: 'video', icon: FiVideo, category: 'វីដេអូ', title: 'បន្ទប់រៀបចំវីដេអូ', copy: 'បញ្ចូលវីដេអូ ឬសំឡេងដែលអ្នកមានសិទ្ធិប្រើ ដើម្បីរៀបចំការងារ។', state: 'អាចប្រើបាន' },
  { id: 'json', icon: FiCode, category: 'អ្នកអភិវឌ្ឍន៍', title: 'រៀបចំ JSON', copy: 'តម្រៀប និងពិនិត្យ JSON របស់អ្នកភ្លាមៗក្នុងកម្មវិធីរុករក។', state: 'អាចប្រើបាន' },
  { id: 'text', icon: FiFileText, category: 'អត្ថបទ', title: 'កែសម្រួលអត្ថបទ', copy: 'បម្លែងអក្សរ លុបចន្លោះលើស និងរៀបចំអត្ថបទឲ្យស្អាត។', state: 'អាចប្រើបាន' },
  { id: 'password', icon: FiLock, category: 'សុវត្ថិភាព', title: 'បង្កើតពាក្យសម្ងាត់', copy: 'បង្កើតពាក្យសម្ងាត់រឹងមាំដោយមិនបញ្ជូនទិន្នន័យចេញ។', state: 'អាចប្រើបាន' },
  { id: 'url', icon: FiLink, category: 'អ្នកអភិវឌ្ឍន៍', title: 'បម្លែងតំណភ្ជាប់', copy: 'អ៊ិនកូដ ឬឌីកូដតំណភ្ជាប់ និងអក្សរពិសេសបានយ៉ាងងាយ។', state: 'អាចប្រើបាន' },
  { id: 'image', icon: FiImage, category: 'រូបភាព', title: 'បន្ទប់កែរូបភាព', copy: 'បង្រួម បម្លែង និងកែទំហំរូបភាពសម្រាប់ការប្រើប្រាស់របស់អ្នក។', state: 'កំពុងរៀបចំ' },
  { id: 'audio', icon: FiMusic, category: 'សំឡេង', title: 'បន្ទប់កែសំឡេង', copy: 'បម្លែងសំឡេង ដកសំឡេងរំខាន និងរៀបចំអត្ថបទសំឡេង។', state: 'កំពុងរៀបចំ' },
];

const CATEGORIES = ['ទាំងអស់', 'វីដេអូ', 'រូបភាព', 'សំឡេង', 'អត្ថបទ', 'អ្នកអភិវឌ្ឍន៍', 'សុវត្ថិភាព'];

const BENEFITS = [
  { icon: FiZap, title: 'ធ្វើការបានលឿន', copy: 'កាត់បន្ថយជំហានដដែលៗ ដើម្បីឲ្យអ្នកមានពេលសម្រាប់ការងារសំខាន់។', badge: 'ពេញនិយម' },
  { icon: FiSliders, title: 'ងាយប្រើ', copy: 'រៀបចំសម្រាប់អ្នកចាប់ផ្តើម ដោយមិនចាំបាច់មានជំនាញបច្ចេកទេស។', badge: 'ងាយចាប់ផ្តើម' },
  { icon: FiLock, title: 'គ្រប់គ្រងបានសុវត្ថិភាព', copy: 'ចូលគណនីមុនប្រើ ដើម្បីគ្រប់គ្រងការងារ និងឯកសាររបស់អ្នក។', badge: 'មានសុវត្ថិភាព' },
  { icon: FiCheckCircle, title: 'គ្រប់ឧបករណ៍នៅកន្លែងតែមួយ', copy: 'អត្ថបទ វីដេអូ រូបភាព និងតំណភ្ជាប់ អាចប្រើបានក្នុងគណនីតែមួយ។', badge: 'រួចរាល់' },
  { icon: FiFileText, title: 'សន្សំពេលវេលា', copy: 'បម្លែង និងរៀបចំឯកសារបានភ្លាមៗ ដោយមិនប្ដូរទៅកម្មវិធីច្រើន។' },
  { icon: FiUser, title: 'សម្រាប់អ្នកគ្រប់គ្នា', copy: 'អ្នកធ្វើការ អ្នកសិក្សា និងអ្នកបង្កើតមាតិកា អាចចាប់ផ្តើមបានងាយ។' },
  { icon: FiImage, title: 'លទ្ធផលស្អាត', copy: 'មានរបៀបរៀបចំច្បាស់ ងាយយកលទ្ធផលទៅប្រើបន្ត។' },
  { icon: FiMusic, title: 'កំពុងបន្ថែមជានិច្ច', copy: 'យើងបន្តបង្កើតឧបករណ៍ថ្មីៗ ដើម្បីឲ្យការងាររបស់អ្នកកាន់តែងាយ។' },
];

const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services';
let googleIdentityServicesPromise;

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleIdentityServicesPromise) return googleIdentityServicesPromise;
  googleIdentityServicesPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID);
    const script = existing || document.createElement('script');
    const ready = () => window.google?.accounts?.id ? resolve() : reject(new Error('Google Identity Services did not initialize'));
    script.addEventListener('load', ready, { once: true });
    script.addEventListener('error', () => reject(new Error('Google Identity Services could not load')), { once: true });
    if (!existing) { script.id = GOOGLE_IDENTITY_SCRIPT_ID; script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true; document.head.appendChild(script); }
  });
  return googleIdentityServicesPromise;
}

function copyText(value) {
  if (navigator.clipboard) navigator.clipboard.writeText(value);
}

export default function ToolsHome() {
  const { customer, googleSignin, logout: customerLogout, setSession } = useCustomer();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ទាំងអស់');
  const [activeTool, setActiveTool] = useState('video');
  const [source, setSource] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [jsonInput, setJsonInput] = useState('{\n  "សារ": "សូមស្វាគមន៍មកកាន់ ROVISTAR TOOLS"\n}');
  const [jsonOutput, setJsonOutput] = useState('');
  const [textInput, setTextInput] = useState('កែសម្រួលអត្ថបទរបស់អ្នកឲ្យស្អាត និងងាយអាន');
  const [textOutput, setTextOutput] = useState('');
  const [urlInput, setUrlInput] = useState('https://rovistar.shop/?tool=video');
  const [urlOutput, setUrlOutput] = useState('');
  const [password, setPassword] = useState('');
  const [toolsShop, setToolsShop] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingTool, setPendingTool] = useState(null);
  const [providerError, setProviderError] = useState('');
  const [providerBusy, setProviderBusy] = useState(false);
  const googleButtonRef = useRef(null);
  const profile = customer;
  const toolsUsername = process.env.REACT_APP_TOOLS_SHOP_USERNAME || 'demo';
  const googleClientId = (toolsShop?.theme?.appearance?.google_client_id || '').trim();
  const telegramBotUsername = (toolsShop?.telegram_bot_username || '').trim();

  useEffect(() => { getShop(toolsUsername).then(setToolsShop).catch(() => setProviderError('មិនអាចភ្ជាប់ប្រព័ន្ធចូលគណនីបានទេ។')); }, [toolsUsername]);

  const shownTools = useMemo(() => TOOLS.filter((tool) => {
    const matchesCategory = category === 'ទាំងអស់' || tool.category === category;
    const haystack = `${tool.title} ${tool.copy} ${tool.category}`;
    return matchesCategory && haystack.includes(query);
  }), [category, query]);
  const active = TOOLS.find((tool) => tool.id === activeTool) || TOOLS[0];

  const openTool = (tool) => {
    if (!profile) { setPendingTool(tool); setLoginOpen(true); return; }
    setActiveTool(tool.id);
    document.getElementById('workbench')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const finishProviderLogin = useCallback((customerProfile) => {
    setLoginOpen(false); setProviderError('');
    if (pendingTool) { setActiveTool(pendingTool.id); setPendingTool(null); setTimeout(() => document.getElementById('workbench')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }
    return customerProfile;
  }, [pendingTool]);
  const handleGoogleCredential = useCallback(async (response) => {
    if (!response?.credential || !toolsShop) return;
    setProviderBusy(true); setProviderError('');
    try { finishProviderLogin(await googleSignin(toolsShop.id, response.credential)); }
    catch (error) { setProviderError(error?.response?.data?.detail || 'មិនអាចចូលជាមួយ Google បានទេ។'); }
    finally { setProviderBusy(false); }
  }, [finishProviderLogin, googleSignin, toolsShop]);
  const handleTelegramAuth = useCallback(async (telegramUser) => {
    if (!toolsShop) return;
    setProviderBusy(true); setProviderError('');
    try { finishProviderLogin(setSession(await customerTelegramSignin({ shop_id: toolsShop.id, ...telegramUser }))); }
    catch (error) { setProviderError(error?.response?.data?.detail || 'មិនអាចចូលជាមួយ Telegram បានទេ។'); }
    finally { setProviderBusy(false); }
  }, [finishProviderLogin, setSession, toolsShop]);
  useEffect(() => {
    let active = true;
    const container = googleButtonRef.current;
    if (!loginOpen || !googleClientId || !container) return undefined;
    loadGoogleIdentityServices().then(() => {
      if (!active || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential, auto_select: false, cancel_on_tap_outside: true });
      container.replaceChildren();
      window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', text: 'continue_with', width: Math.min(container.clientWidth || 350, 400) });
    }).catch(() => active && setProviderError('Google មិនអាចបើកបានទេ។'));
    return () => { active = false; };
  }, [googleClientId, handleGoogleCredential, loginOpen]);
  const logout = () => { customerLogout(); };
  const generatePassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
    const values = new Uint32Array(18);
    crypto.getRandomValues(values);
    setPassword(Array.from(values, (value) => alphabet[value % alphabet.length]).join(''));
  };

  return (
    <div className="tools-home khmer-tools-home">
      <div className="tools-noise" aria-hidden="true" />
      <header className="tools-nav">
        <a href="/" className="tools-brand" aria-label="ROVISTAR TOOLS"><span>R</span><b>ROVISTAR</b><i>TOOLS</i></a>
        <nav>{profile ? <><a href="#tools">ឧបករណ៍</a><a href="#workbench">កន្លែងធ្វើការ</a><a href="#roadmap">មុខងារថ្មី</a></> : <><a href="#benefits">អត្ថប្រយោជន៍</a><a href="#how-it-works">របៀបប្រើ</a><a href="#access">ចូលប្រើ</a></>}</nav>
        <div className="tools-account-actions">
          {profile ? <><span className="tools-user-name">{profile.avatar_url ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" /> : <FiUser />} {profile.name || profile.username || profile.email}</span><button type="button" className="tools-login-link" onClick={logout}><FiLogOut /> ចាកចេញ</button></> : <button type="button" className="tools-login-link" onClick={() => setLoginOpen(true)}><FiLogIn /> ចូលគណនី</button>}
          <button type="button" className="tools-nav-button" onClick={() => profile ? document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' }) : setLoginOpen(true)}>{profile ? 'ចូលប្រើឧបករណ៍' : 'ចាប់ផ្តើមប្រើ'} <FiArrowRight /></button>
        </div>
      </header>

      <main>
        <section className="tools-hero reference-hero">
          <div className="tools-hero-copy reference-hero-copy">
            <p className="reference-badge"><FiZap /> ឧបករណ៍ឆ្លាតវៃសម្រាប់ការងារប្រចាំថ្ងៃ</p>
            <h1>ធ្វើការបានងាយ<br /><em>លឿនជាងមុន</em><br />រាល់ថ្ងៃ។</h1>
            <p className="reference-subtitle">ឧបករណ៍ឌីជីថលជាភាសាខ្មែរ សម្រាប់ជួយអ្នកធ្វើការបានលឿន ស្អាត និងមានប្រសិទ្ធភាព។</p>
            <p className="tools-hero-lede">ចាប់ផ្តើមពីអត្ថបទ តំណភ្ជាប់ និងឯកសាររបស់អ្នក។ ចូលគណនីម្តង ដើម្បីបើកប្រើ Tool ទាំងអស់នៅកន្លែងតែមួយ។</p>
            <div className="tools-hero-actions"><button type="button" onClick={() => profile ? document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' }) : setLoginOpen(true)}>{profile ? 'ចូលប្រើឧបករណ៍' : 'ចាប់ផ្តើមប្រើ'} <FiArrowRight /></button><a href="#tools">មើលឧបករណ៍ទាំងអស់</a></div>
            <p className="reference-helper">ងាយប្រើ សម្រាប់អ្នកចាប់ផ្តើម និងអ្នកធ្វើការជំនាញ។</p>
          </div>
          <div className="reference-phone-scene" aria-label="គំរូនៃឧបករណ៍ ROVISTAR">
            <div className="reference-phone-shadow" />
            <div className="reference-phone">
              <div className="reference-phone-top"><div className="reference-progress"><span /></div><div className="reference-score"><FiHeart /> <b>៥</b></div></div>
              <div className="reference-lesson-card"><div className="reference-sun">☀</div><div className="reference-lesson-row"><b>រៀបចំ<br />ការងារ</b><button type="button" aria-label="ស្តាប់"><FiVolume2 /></button></div><small>ឧបករណ៍ឆ្លាតវៃសម្រាប់អ្នក</small><strong>ងាយប្រើ និងរហ័ស</strong></div>
              <button type="button" className="reference-continue" onClick={() => profile ? document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' }) : setLoginOpen(true)}>ចាប់ផ្តើមប្រើ</button>
            </div>
            <div className="reference-mascot" aria-hidden="true"><span className="mascot-bubble">សួស្តី!<small>ត្រៀមធ្វើការហើយឬនៅ?</small></span><div className="mascot-head"><i /><i /></div><div className="mascot-body"><span>R</span></div><div className="mascot-scarf" /></div>
          </div>
        </section>

        <section className="tools-benefits" id="benefits">
          <div className="tools-benefits-heading"><div><p className="tools-eyebrow">ហេតុអ្វីជ្រើសរើស ROVISTAR TOOLS</p><h2>អត្ថប្រយោជន៍ដែលអ្នកទទួលបាន។</h2></div><p>ចូលមើលអត្ថប្រយោជន៍ជាមុន ហើយចូលគណនីនៅពេលអ្នកត្រៀមប្រើឧបករណ៍។</p></div>
          <div className="tools-benefits-grid">{BENEFITS.map((benefit, index) => { const Icon = benefit.icon; return <article className={`tools-benefit-card ${index < 4 ? 'is-featured' : ''}`} key={benefit.title}>{benefit.badge && <span>{benefit.badge}</span>}<div className="tools-benefit-icon"><Icon /></div><h3>{benefit.title}</h3><p>{benefit.copy}</p><div className="tools-benefit-footer"><small>{index < 4 ? 'អត្ថប្រយោជន៍សំខាន់' : 'ROVISTAR TOOLS'}</small><button type="button" onClick={() => setLoginOpen(true)}>ចូលប្រើ <FiArrowRight /></button></div></article>; })}</div>
        </section>

        <section className="tools-how" id="how-it-works"><div className="tools-how-number">០១</div><div><p className="tools-eyebrow">របៀបចាប់ផ្តើម</p><h2>ចូលគណនីម្តង<br />រួចប្រើបានគ្រប់ឧបករណ៍។</h2></div><ol><li><b>១</b><span>បង្កើត ឬចូលគណនីរបស់អ្នក</span></li><li><b>២</b><span>ជ្រើសរើសឧបករណ៍ដែលអ្នកត្រូវការ</span></li><li><b>៣</b><span>ចាប់ផ្តើមការងារ និងរក្សាទុកលទ្ធផល</span></li></ol><button type="button" id="access" onClick={() => setLoginOpen(true)}>ចូលគណនីដើម្បីចាប់ផ្តើម <FiArrowRight /></button></section>

        {profile && <><section className="tools-directory" id="tools">
          <div className="tools-directory-heading"><div><p className="tools-eyebrow">បញ្ជីឧបករណ៍</p><h2>ជ្រើសរើសការងារដែលអ្នកចង់ធ្វើ។</h2></div><p>សូមចូលគណនីជាមុន ដើម្បីបើកប្រើឧបករណ៍ និងរក្សាទុកការងាររបស់អ្នក។</p></div>
          <div className="tools-filter-row"><div className="tools-search"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ស្វែងរកឧបករណ៍" />{query && <button type="button" onClick={() => setQuery('')} aria-label="លុបការស្វែងរក"><FiX /></button>}</div><div className="tools-categories">{CATEGORIES.map((item) => <button key={item} type="button" className={item === category ? 'is-active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
          <div className="tools-card-grid">{shownTools.map((tool, index) => { const Icon = tool.icon; return <article key={tool.id} className={`tools-card tools-card-${index % 4}`}>{index < 4 && <span className="tools-card-badge">ណែនាំ</span>}<div className="tools-card-mark"><Icon /></div><span>{tool.category}</span><h3>{tool.title}</h3><p>{tool.copy}</p><div><small className={tool.state === 'អាចប្រើបាន' ? 'is-ready' : ''}>{tool.state}</small><button type="button" onClick={() => openTool(tool)}>បើកប្រើ <FiArrowRight /></button></div></article>; })}</div>
        </section>

        <section className="tools-workbench" id="workbench">
          <div className="tools-workbench-sidebar"><p className="tools-eyebrow">កន្លែងធ្វើការ</p><h2>{active.title}</h2><p>{active.copy}</p><div className="tools-mini-list">{TOOLS.slice(0, 5).map((tool) => <button key={tool.id} type="button" className={tool.id === activeTool ? 'is-active' : ''} onClick={() => openTool(tool)}>{tool.title}<FiArrowRight /></button>)}</div></div>
          <div className="tools-workbench-panel">
            {!profile && <div className="tools-gate"><FiLock /><h3>ចូលគណនីដើម្បីចាប់ផ្តើមប្រើ</h3><p>គណនីរបស់អ្នកអាចចូលប្រើឧបករណ៍ទាំងអស់ និងរក្សាទុកការងាររបស់អ្នកបាន។</p><button type="button" onClick={() => setLoginOpen(true)}>ចូលគណនី <FiArrowRight /></button></div>}
            {profile && activeTool === 'video' && <div className="tools-panel-content"><div className="tools-panel-title"><FiVideo /><div><span>បញ្ចូលវីដេអូដែលមានសិទ្ធិប្រើ</span><h3>បន្ថែមឯកសាររបស់អ្នកមកកន្លែងធ្វើការ។</h3></div></div><label className="tools-file-drop"><input type="file" accept="video/*,audio/*" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} /><FiPlay /><b>{selectedFile ? selectedFile.name : 'ជ្រើសរើសវីដេអូ ឬឯកសារសំឡេង'}</b><small>{selectedFile ? `បានជ្រើសរើស ${Math.ceil(selectedFile.size / 1024 / 1024)} MB` : 'ឯកសាររបស់អ្នកនៅលើឧបករណ៍នេះ រហូតដល់អ្នកចាប់ផ្តើមការងារ។'}</small></label><div className="tools-or">ឬ បញ្ចូលតំណឯកសារដែលអ្នកមានសិទ្ធិប្រើ</div><input className="tools-input" value={source} onChange={(event) => setSource(event.target.value)} placeholder="https://example.com/video.mp4" /><p className="tools-panel-note"><FiCheckCircle /> ប្រើតែឯកសារ និងខ្លឹមសារដែលអ្នកជាម្ចាស់ ឬមានសិទ្ធិដំណើរការ។</p></div>}
            {profile && activeTool === 'json' && <div className="tools-panel-content"><div className="tools-panel-title"><FiCode /><div><span>ឧបករណ៍សម្រាប់អ្នកអភិវឌ្ឍន៍</span><h3>តម្រៀប និងពិនិត្យ JSON។</h3></div></div><textarea value={jsonInput} onChange={(event) => setJsonInput(event.target.value)} className="tools-textarea" spellCheck="false" /><div className="tools-panel-actions"><button type="button" onClick={() => { try { setJsonOutput(JSON.stringify(JSON.parse(jsonInput), null, 2)); } catch (error) { setJsonOutput(`JSON មិនត្រឹមត្រូវ៖ ${error.message}`); } }}>តម្រៀប JSON <FiArrowRight /></button>{jsonOutput && <button type="button" className="tools-copy" onClick={() => copyText(jsonOutput)}><FiCopy /> ចម្លង</button>}</div>{jsonOutput && <pre className="tools-output">{jsonOutput}</pre>}</div>}
            {profile && activeTool === 'text' && <div className="tools-panel-content"><div className="tools-panel-title"><FiFileText /><div><span>ឧបករណ៍អត្ថបទ</span><h3>កែសម្រួលអត្ថបទបានភ្លាមៗ។</h3></div></div><textarea value={textInput} onChange={(event) => setTextInput(event.target.value)} className="tools-textarea" /><div className="tools-transform-row"><button type="button" onClick={() => setTextOutput(textInput.toUpperCase())}>អក្សរធំ</button><button type="button" onClick={() => setTextOutput(textInput.toLowerCase())}>អក្សរតូច</button><button type="button" onClick={() => setTextOutput(textInput.replace(/\s+/g, ' ').trim())}>លុបចន្លោះលើស</button></div>{textOutput && <div className="tools-output tools-plain-output">{textOutput}<button type="button" onClick={() => copyText(textOutput)} aria-label="ចម្លង"><FiCopy /></button></div>}</div>}
            {profile && activeTool === 'password' && <div className="tools-panel-content"><div className="tools-panel-title"><FiLock /><div><span>ឧបករណ៍សុវត្ថិភាព</span><h3>បង្កើតពាក្យសម្ងាត់រឹងមាំ។</h3></div></div><div className="tools-password-orb"><FiLock /></div><button type="button" className="tools-primary-action" onClick={generatePassword}>បង្កើតពាក្យសម្ងាត់ <FiZap /></button>{password && <div className="tools-output tools-plain-output"><code>{password}</code><button type="button" onClick={() => copyText(password)} aria-label="ចម្លង"><FiCopy /></button></div>}</div>}
            {profile && activeTool === 'url' && <div className="tools-panel-content"><div className="tools-panel-title"><FiLink /><div><span>ឧបករណ៍សម្រាប់អ្នកអភិវឌ្ឍន៍</span><h3>បម្លែងតំណភ្ជាប់បានងាយ។</h3></div></div><textarea value={urlInput} onChange={(event) => setUrlInput(event.target.value)} className="tools-textarea" /><div className="tools-transform-row"><button type="button" onClick={() => setUrlOutput(encodeURIComponent(urlInput))}>អ៊ិនកូដ</button><button type="button" onClick={() => { try { setUrlOutput(decodeURIComponent(urlInput)); } catch { setUrlOutput('តំណភ្ជាប់នេះមិនអាចឌីកូដបានទេ។'); } }}>ឌីកូដ</button></div>{urlOutput && <div className="tools-output tools-plain-output">{urlOutput}<button type="button" onClick={() => copyText(urlOutput)} aria-label="ចម្លង"><FiCopy /></button></div>}</div>}
            {profile && ['image', 'audio'].includes(activeTool) && <div className="tools-panel-content tools-coming"><FiSliders /><span>កំពុងរៀបចំ</span><h3>{active.title} នឹងមកដល់ឆាប់ៗនេះ។</h3><p>យើងកំពុងបន្ថែមការនាំចូលឯកសារ ការកែសម្រួលក្នុងកម្មវិធីរុករក និងប្រវត្តិការនាំចេញ។</p><button type="button" onClick={() => setActiveTool('video')}>សាកល្បងបន្ទប់វីដេអូ <FiArrowRight /></button></div>}
          </div>
        </section>

        <section className="tools-roadmap" id="roadmap"><div><p className="tools-eyebrow">អ្វីដែលនឹងមកដល់</p><h2>បង្កើតសម្រាប់ការងាររបស់អ្នករាល់ថ្ងៃ។</h2></div><ol><li><b>០១</b><span><strong>ការងារវីដេអូ</strong>បម្លែង បង្រួម បង្កើតចំណងជើង និងនាំចេញឯកសារដែលអ្នកមានសិទ្ធិប្រើ។</span></li><li><b>០២</b><span><strong>កន្លែងរក្សាទុកឯកសារ</strong>រក្សាប្រវត្តិការងារ កំណត់ស្រេចប្រើ និងគ្រប់គ្រងឯកសារដោយសុវត្ថិភាព។</span></li><li><b>០៣</b><span><strong>ឧបករណ៍ AI ភាសាខ្មែរ</strong>បកប្រែ សង្ខេបអត្ថបទ សរសេរចំណងជើង និងកែសម្រួលសំណេរ។</span></li></ol></section></>}
      </main>
      <footer className="tools-footer"><span>ROVISTAR TOOLS / ធ្វើការឲ្យងាយជាងមុន</span><span>សូមប្រើតែឯកសារ និងខ្លឹមសារដែលអ្នកមានសិទ្ធិប្រើ។</span></footer>

      {loginOpen && <div className="tools-login-backdrop" role="presentation" onMouseDown={() => setLoginOpen(false)}><section className="tools-login-modal tools-provider-modal" role="dialog" aria-modal="true" aria-labelledby="tools-login-title" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="tools-modal-close" onClick={() => setLoginOpen(false)} aria-label="បិទ"><FiX /></button><div className="tools-login-icon"><FiLock /></div><p>គណនី ROVISTAR TOOLS</p><h2 id="tools-login-title">ចូលគណនីដោយសុវត្ថិភាព</h2><span>ជ្រើសរើស Google ឬ Telegram របស់អ្នក។ ឈ្មោះ អ៊ីមែល និងរូបភាព Profile នឹងមកពីគណនីដែលអ្នកជ្រើសរើសដោយផ្ទាល់។</span>{providerError && <em className="tools-provider-error">{providerError}</em>}<div className="tools-provider-options"><div className="tools-provider-option"><div className="tools-provider-heading"><FcGoogle /><div><b>បន្តជាមួយ Google</b><small>ប្រើ Gmail និងរូបភាព Profile ពិតរបស់អ្នក</small></div></div>{googleClientId ? <div ref={googleButtonRef} className="tools-google-button" /> : <div className="tools-provider-pending">កំពុងរៀបចំ Google Sign-In</div>}</div><div className="tools-provider-divider"><span>ឬ</span></div><div className="tools-provider-option"><div className="tools-provider-heading tools-telegram-heading"><FaTelegramPlane /><div><b>បន្តជាមួយ Telegram</b><small>ប្រើឈ្មោះ Username និងរូបភាព Profile ពិតរបស់អ្នក</small></div></div>{telegramBotUsername ? <TelegramLogin botUsername={telegramBotUsername} onAuth={handleTelegramAuth} label="Telegram មិនទាន់រៀបចំ" /> : <div className="tools-provider-pending">កំពុងរៀបចំ Telegram Sign-In</div>}</div></div>{providerBusy && <small className="tools-provider-loading">កំពុងផ្ទៀងផ្ទាត់គណនីរបស់អ្នក...</small>}<small>ROVISTAR TOOLS មិនស្នើសុំពាក្យសម្ងាត់ Google ឬ Telegram របស់អ្នកទេ។</small></section></div>}
    </div>
  );
}
