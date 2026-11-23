import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FaTelegramPlane } from 'react-icons/fa';
import {
  FiAlertCircle, FiArrowLeft, FiArrowRight, FiCheckCircle, FiCopy, FiDownload,
  FiEdit3, FiFileText, FiImage, FiLock, FiLogIn, FiLogOut, FiPlay, FiShield,
  FiMenu, FiPackage, FiType, FiUploadCloud, FiUser, FiVideo, FiX, FiZap,
} from 'react-icons/fi';
import './ToolsHome.css';
import rovistarAvatar from '../assets/rovistar-avatar.jpg';
import { customerTelegramSignin, getProducts, getShop } from '../api';
import TelegramLogin from '../components/TelegramLogin';
import { useCustomer } from '../contexts/CustomerContext';

const TOOL_CARDS = [
  { id: 'text-editor', icon: FiEdit3, title: 'កែសម្រួលអត្ថបទ', summary: 'ពិនិត្យរចនាសម្ព័ន្ធ សម្អាតអត្ថបទ និងរៀបចំសំណេរឱ្យងាយអាន។', label: 'អត្ថបទ' },
  { id: 'document-studio', icon: FiFileText, title: 'បង្កើតឯកសារ', summary: 'រៀបចំអត្ថបទ ពណ៌ រូបសញ្ញា និងបោះពុម្ពជា PDF ឬរូបភាព។', label: 'ឯកសារ' },
  { id: 'name-styles', icon: FiType, title: 'ស្តាយឈ្មោះ', summary: 'បម្លែងឈ្មោះអង់គ្លេសទៅជា 74 ស្តាយ សម្រាប់ចម្លងទៅប្រើភ្លាមៗ។', label: 'អក្សរ' },
];

const BENEFITS = [
  ['FiZap', 'ចូលតែម្តង', 'មានគណនីតែមួយ សម្រាប់ចូលប្រើឧបករណ៍ដែលអ្នកត្រូវការ។'],
  ['FiShield', 'គោរពឯកជនភាព', 'ឯកសារ និងការអនុញ្ញាតត្រូវមានការយល់ព្រមច្បាស់ពីអ្នកជាមុន។'],
  ['FiFileText', 'លទ្ធផលយកទៅប្រើបាន', 'រៀបចំអត្ថបទ ឯកសារ និងស្តាយឈ្មោះ រួចចម្លង ឬបោះពុម្ពបាន។'],
  ['FiUser', 'ងាយប្រើជាភាសាខ្មែរ', 'ផ្ទាំងសាមញ្ញ សម្រាប់អ្នកចាប់ផ្តើម និងអ្នកធ្វើការរាល់ថ្ងៃ។'],
];

const ICONS = { FiZap, FiShield, FiFileText, FiUser };
const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services';
let googleIdentityServicesPromise;

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleIdentityServicesPromise) return googleIdentityServicesPromise;
  googleIdentityServicesPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID);
    const script = existing || document.createElement('script');
    const ready = () => (window.google?.accounts?.id ? resolve() : reject(new Error('Google Identity Services did not initialize')));
    script.addEventListener('load', ready, { once: true });
    script.addEventListener('error', () => reject(new Error('Google Identity Services could not load')), { once: true });
    if (!existing) {
      script.id = GOOGLE_IDENTITY_SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return googleIdentityServicesPromise;
}

function copyText(value) {
  if (navigator.clipboard) navigator.clipboard.writeText(value);
}

function makeStyledAlphabet(input, offsetUpper, offsetLower, offsetDigits) {
  return [...input].map((char) => {
    const code = char.codePointAt(0);
    if (code >= 65 && code <= 90 && offsetUpper) return String.fromCodePoint(offsetUpper + code - 65);
    if (code >= 97 && code <= 122 && offsetLower) return String.fromCodePoint(offsetLower + code - 97);
    if (code >= 48 && code <= 57 && offsetDigits) return String.fromCodePoint(offsetDigits + code - 48);
    return char;
  }).join('');
}

const BASE_STYLES = [
  ['ដិត', (v) => makeStyledAlphabet(v, 0x1D400, 0x1D41A, 0x1D7CE)],
  ['ទ្រេត', (v) => makeStyledAlphabet(v, 0x1D434, 0x1D44E)],
  ['ដិតទ្រេត', (v) => makeStyledAlphabet(v, 0x1D468, 0x1D482)],
  ['អក្សរធំ', (v) => v.toUpperCase()],
  ['សរសេរដៃ', (v) => makeStyledAlphabet(v, 0x1D49C, 0x1D4B6)],
  ['ដិតសរសេរដៃ', (v) => makeStyledAlphabet(v, 0x1D4D0, 0x1D4EA)],
  ['អក្សរព្រីន', (v) => makeStyledAlphabet(v, 0x1D504, 0x1D51E)],
  ['ដិតព្រីន', (v) => makeStyledAlphabet(v, 0x1D56C, 0x1D586)],
  ['អក្សរទ្វេ', (v) => makeStyledAlphabet(v, 0x1D538, 0x1D552)],
  ['ដិតទ្វេ', (v) => makeStyledAlphabet(v, 0x1D5D4, 0x1D5EE)],
  ['សាមញ្ញ', (v) => makeStyledAlphabet(v, 0x1D5A0, 0x1D5BA)],
  ['សាមញ្ញដិត', (v) => makeStyledAlphabet(v, 0x1D5D4, 0x1D5EE)],
  ['ទទឹងពេញ', (v) => [...v].map((c) => (c === ' ' ? '　' : (c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126 ? String.fromCharCode(c.charCodeAt(0) + 0xFEE0) : c))).join('')],
  ['អក្សរតូច', (v) => v.toLowerCase()],
];

const DECORATIONS = ['', '✦ ', '✧ ', '★ ', '• ', '꧁ ', '『 ', '【 ', '☾ ', '❖ ', '♡ ', '༺ '];
const CLOSERS = ['', ' ✦', ' ✧', ' ★', ' •', ' ꧂', ' 』', ' 】', ' ☽', ' ❖', ' ♡', ' ༻'];

function getNameStyles(value) {
  return Array.from({ length: 74 }, (_, index) => {
    const styleIndex = index % BASE_STYLES.length;
    const decorationIndex = Math.floor(index / BASE_STYLES.length);
    const [name, transform] = BASE_STYLES[styleIndex];
    return {
      id: index + 1,
      name: `${index + 1}. ${decorationIndex ? 'លម្អ ' : ''}${name}`,
      value: `${DECORATIONS[decorationIndex]}${transform(value)}${CLOSERS[decorationIndex]}`,
    };
  });
}

function ToolHeader({ card }) {
  const Icon = card.icon;
  return <header className="tool-screen-header"><Link to="/tools" className="tool-back"><FiArrowLeft /> ត្រឡប់ទៅឧបករណ៍ទាំងអស់</Link><span>{card.label}</span><h1><Icon /> {card.title}</h1><p>{card.summary}</p></header>;
}

function VideoImportTool() {
  const [file, setFile] = useState(null);
  const [source, setSource] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);
  return <section className="tool-workspace"><div className="tool-notice"><FiShield /><p><b>ការប្រើប្រាស់ដោយមានសិទ្ធិ</b> បញ្ចូលបានតែឯកសារ ឬតំណផ្ទាល់ដែលអ្នកជាម្ចាស់ ឬទទួលសិទ្ធិប្រើប្រាស់។</p></div><label className="tool-upload"><input type="file" accept="video/*,audio/*" onChange={(event) => setFile(event.target.files?.[0] || null)} /><FiUploadCloud /><b>{file ? file.name : 'ជ្រើសរើសវីដេអូ ឬសំឡេងពីឧបករណ៍របស់អ្នក'}</b><small>{file ? `${Math.ceil(file.size / 1024 / 1024)} MB · រក្សាទុកនៅលើ browser របស់អ្នក` : 'ជ្រើសរើសឯកសារដែលអ្នកមានសិទ្ធិប្រើ។'}</small></label><div className="tool-divider">ឬ បញ្ចូលតំណផ្ទាល់របស់ឯកសារអ្នក</div><label className="field-label">តំណឯកសារ<input value={source} onChange={(event) => setSource(event.target.value)} placeholder="https://example.com/owned-video.mp4" /></label><label className="consent-check"><input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} /> ខ្ញុំបញ្ជាក់ថាខ្ញុំជាម្ចាស់ ឬមានសិទ្ធិប្រើប្រាស់ខ្លឹមសារនេះ។</label>{file && <div className="tool-result"><FiCheckCircle /><div><b>ឯកសាររួចរាល់សម្រាប់អ្នក</b><span>អ្នកអាចបើក ឬទាញយកឯកសារដើមរបស់អ្នកបាន។</span></div>{authorized && <a href={fileUrl} download={file.name}><FiDownload /> ទាញយកឯកសារ</a>}</div>}{source && authorized && <div className="tool-result"><FiCheckCircle /><div><b>បានទទួលតំណ</b><span>តំណនេះត្រូវបានបង្ហាញសម្រាប់ឯកសារដែលអ្នកមានសិទ្ធិប្រើប៉ុណ្ណោះ។</span></div><a href={source} target="_blank" rel="noreferrer"><FiPlay /> បើកតំណ</a></div>}</section>;
}

function TextEditorTool() {
  const [input, setInput] = useState('');
  const normalized = input.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const sentences = normalized ? normalized.split(/[។.!?]+/).filter(Boolean).length : 0;
  const notes = [
    !normalized && 'ចាប់ផ្តើមដោយបញ្ចូលអត្ថបទរបស់អ្នក។',
    normalized && normalized.length < 80 && 'អត្ថបទខ្លី។ អាចបន្ថែមគោលបំណង ឬព័ត៌មានសំខាន់ឱ្យច្បាស់ជាងមុន។',
    normalized && !/[។.!?]$/.test(normalized) && 'គួរបញ្ចប់ប្រយោគចុងក្រោយដោយសញ្ញាវណ្ណយុត្តិ។',
    normalized && sentences > 8 && 'អត្ថបទមានច្រើនប្រយោគ។ សាកបែងចែកជាកថាខណ្ឌខ្លីៗ ដើម្បីងាយអាន។',
    normalized && 'បានសម្អាតចន្លោះលើស និងរក្សារចនាសម្ព័ន្ធអត្ថបទរបស់អ្នក។',
  ].filter(Boolean);
  return <section className="tool-workspace two-column-tool"><div><label className="field-label">បញ្ចូលអត្ថបទ<textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="បិទភ្ជាប់ ឬសរសេរអត្ថបទរបស់អ្នកនៅទីនេះ..." rows="14" /></label><div className="tool-actions"><button type="button" onClick={() => setInput(normalized)}>សម្អាតអត្ថបទ <FiZap /></button><button type="button" className="secondary" onClick={() => copyText(normalized)} disabled={!normalized}><FiCopy /> ចម្លងលទ្ធផល</button></div></div><aside className="text-review"><span>ការពិនិត្យដំបូង</span><h2>អត្ថបទរបស់អ្នក</h2><div className="review-stats"><b>{normalized.length}</b><small>តួអក្សរ</small><b>{sentences}</b><small>ប្រយោគ</small></div><ul>{notes.map((note) => <li key={note}><FiCheckCircle />{note}</li>)}</ul>{normalized && <div className="clean-preview">{normalized}</div>}<p className="review-footnote">មុខងារនេះពិនិត្យក្នុង browser របស់អ្នក។ ការកែសម្រួល AI ពេញលេញត្រូវការសេវា AI ដែលបានកំណត់សុវត្ថិភាពនៅ server។</p></aside></section>;
}

function DocumentStudioTool() {
  const [title, setTitle] = useState('ឯកសាររបស់ខ្ញុំ');
  const [body, setBody] = useState('សរសេរខ្លឹមសាររបស់អ្នកនៅទីនេះ។\n\nអ្នកអាចរៀបចំឯកសារ បន្ថែមពណ៌ ហើយបោះពុម្ពជាឯកសារ PDF បាន។');
  const [color, setColor] = useState('#1674e8');
  const [logo, setLogo] = useState('');
  const downloadImage = () => {
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1000;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, 26); ctx.fillStyle = '#123866'; ctx.font = 'bold 62px sans-serif'; ctx.fillText(title || 'ឯកសារ', 100, 150);
    ctx.fillStyle = '#29445f'; ctx.font = '32px sans-serif'; let y = 240;
    body.split('\n').forEach((line) => { for (const segment of line.match(/.{1,64}(\s|$)/g) || [' ']) { ctx.fillText(segment.trim(), 100, y); y += 52; } y += 16; });
    const link = document.createElement('a'); link.download = 'rovistar-document.png'; link.href = canvas.toDataURL('image/png'); link.click();
  };
  return <section className="tool-workspace document-studio"><div className="document-controls"><label className="field-label">ចំណងជើង<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field-label">ខ្លឹមសារ<textarea value={body} onChange={(event) => setBody(event.target.value)} rows="12" /></label><div className="field-row"><label className="field-label">ពណ៌សំខាន់<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label><label className="field-label">រូបសញ្ញា<input type="file" accept="image/*" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) setLogo(URL.createObjectURL(selected)); }} /></label></div><div className="tool-actions"><button type="button" onClick={() => window.print()}><FiFileText /> បោះពុម្ព / រក្សាទុកជា PDF</button><button type="button" className="secondary" onClick={downloadImage}><FiImage /> ទាញយកជា PNG</button></div></div><article className="document-preview" style={{ '--accent': color }}><div className="preview-bar" />{logo && <img src={logo} alt="រូបសញ្ញាឯកសារ" />}<h2>{title || 'ឯកសាររបស់ខ្ញុំ'}</h2><p>{body || 'សរសេរខ្លឹមសាររបស់អ្នកនៅទីនេះ។'}</p><small>ROVISTAR TOOLS</small></article></section>;
}

function NameStylesTool() {
  const [name, setName] = useState('Rovistar');
  const [preset, setPreset] = useState('classic');
  const styles = useMemo(() => getNameStyles(name || 'Name'), [name]);
  const posterName = (name || 'ROVISTAR').slice(0, 24).toUpperCase();
  const savePoster = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600; canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f7faff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffc331'; ctx.beginPath(); ctx.moveTo(160, 145); ctx.lineTo(180, 205); ctx.lineTo(245, 205); ctx.lineTo(192, 243); ctx.lineTo(214, 305); ctx.lineTo(160, 267); ctx.lineTo(106, 305); ctx.lineTo(128, 243); ctx.lineTo(75, 205); ctx.lineTo(140, 205); ctx.closePath(); ctx.fill();
    ctx.font = '900 170px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 26; ctx.strokeStyle = '#102c65'; ctx.fillStyle = '#edf5ff'; ctx.strokeText(posterName, 800, 470); ctx.fillText(posterName, 800, 470);
    ctx.fillStyle = '#1674e8'; ctx.fillText(posterName, 800, 505);
    ctx.fillStyle = '#e84e62'; ctx.fillRect(450, 650, 700, 110); ctx.fillStyle = '#fff'; ctx.font = '800 38px sans-serif'; ctx.fillText('MADE WITH ROVISTAR TOOLS', 800, 720);
    const link = document.createElement('a'); link.download = 'rovistar-name-poster.png'; link.href = canvas.toDataURL('image/png'); link.click();
  };
  return <section className="tool-workspace name-maker"><div className="name-maker-top"><label className="field-label name-input">វាយឈ្មោះជាអក្សរអង់គ្លេស<input value={name} maxLength="500" onChange={(event) => setName(event.target.value)} placeholder="ឧ. Sok Wen" /></label><button type="button" className="name-save" onClick={savePoster}><FiDownload /> រក្សាទុករូបភាព</button></div><div className="poster-maker-layout"><section className={`name-poster poster-${preset}`}><i className="poster-star star-one">★</i><i className="poster-star star-two">★</i><span>ROVISTAR NAME MAKER</span><h2>{posterName}</h2><div>MADE WITH ROVISTAR TOOLS</div></section><aside className="poster-controls"><b>ជ្រើសរើសស្តាយ</b><div className="poster-presets">{[['classic','ខៀវដិត'],['bubble','អក្សរមូល'],['retro','ស្តាយ Retro'],['pink','ផ្កាឈូក']].map(([id, label]) => <button type="button" key={id} onClick={() => setPreset(id)} className={preset === id ? 'is-active' : ''}><i className={`preset-dot ${id}`} />{label}</button>)}</div><p>រូបភាព Preview ផ្លាស់ប្ដូរភ្លាមៗ។ ចុច “រក្សាទុករូបភាព” ដើម្បីទាញយក Poster របស់អ្នក។</p><button type="button" className="copy-name" onClick={() => copyText(posterName)}><FiCopy /> ចម្លងឈ្មោះ</button></aside></div><p className="tool-hint">ស្តាយអក្សរ {styles.length} ប្រភេទ សម្រាប់ចម្លងទៅប្រើក្នុង Social Media:</p><div className="style-grid">{styles.map((style) => <article key={style.id}><small>{style.name}</small><strong>{style.value}</strong><button type="button" onClick={() => copyText(style.value)}><FiCopy /> ចម្លង</button></article>)}</div></section>;
}

function ServiceCatalog({ shopId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (!shopId) return; getProducts(shopId).then((data) => setItems((data || []).filter((item) => item.is_active !== false))).finally(() => setLoading(false)); }, [shopId]);
  return <section className="tool-shell"><header className="tool-screen-header"><Link to="/tools" className="tool-back"><FiArrowLeft /> ត្រឡប់ទៅឧបករណ៍ទាំងអស់</Link><span>សេវាកម្ម</span><h1><FiPackage /> សេវាកម្ម និង Top up</h1><p>សេវាកម្មដែលអ្នកគ្រប់គ្រងបានបញ្ចូលពីផ្ទាំង Admin នឹងបង្ហាញនៅទីនេះ។</p></header>{loading ? <div className="tool-workspace">កំពុងបើកសេវាកម្ម...</div> : <div className="service-grid">{items.map((item) => <article key={item.id} className="service-card"><h2>{item.name}</h2><p>{item.description || 'សេវាកម្មពី ROVISTAR'}</p><b>${Number(item.price || 0).toFixed(2)}</b></article>)}{!items.length && <div className="tool-workspace service-empty"><FiPackage /><h2>មិនទាន់មានសេវាកម្មទេ</h2><p>បន្ថែមផលិតផល ឬ Top up ក្នុង Admin រួចសេវាកម្មនឹងបង្ហាញនៅទីនេះ។</p></div>}</div>}</section>;
}

function ToolView({ id }) {
  const card = TOOL_CARDS.find((tool) => tool.id === id);
  if (!card) return <section className="tool-shell"><div className="missing-tool"><FiAlertCircle /><h1>រកមិនឃើញឧបករណ៍នេះទេ</h1><Link to="/tools">ត្រឡប់ទៅផ្ទាំងឧបករណ៍</Link></div></section>;
  return <section className="tool-shell"><ToolHeader card={card} />{id === 'video-import' && <VideoImportTool />}{id === 'text-editor' && <TextEditorTool />}{id === 'document-studio' && <DocumentStudioTool />}{id === 'name-styles' && <NameStylesTool />}</section>;
}

function Dashboard({ profile }) {
  return <section className="tool-dashboard"><div className="dashboard-intro"><span>ROVISTAR TOOLS</span><h1>សួស្តី {profile?.name || profile?.username || 'មិត្ត'} 👋</h1><p>ជ្រើសរើសឧបករណ៍មួយ ដើម្បីចាប់ផ្តើមការងាររបស់អ្នក។ Tool នីមួយៗមានផ្ទាំងដាច់ដោយឡែក។</p></div><div className="dashboard-grid">{TOOL_CARDS.map((tool, index) => { const Icon = tool.icon; return <Link to={`/tools/${tool.id}`} className="dashboard-card" key={tool.id}><span>0{index + 1}</span><i><Icon /></i><h2>{tool.title}</h2><p>{tool.summary}</p><b>បើកឧបករណ៍ <FiArrowRight /></b></Link>; })}</div><Link to="/tools/services" className="service-entry"><FiPackage /><span><b>សេវាកម្ម និង Top up</b><small>មើលសេវាកម្មដែលបានបញ្ចូលពី Admin</small></span><FiArrowRight /></Link></section>;
}

export default function ToolsHome() {
  const { customer, googleSignin, logout, setSession } = useCustomer();
  const { toolId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [toolsShop, setToolsShop] = useState(null);
  const [loginOpen, setLoginOpen] = useState(Boolean(location.state?.openLogin));
  const [providerError, setProviderError] = useState('');
  const [providerBusy, setProviderBusy] = useState(false);
  const googleButtonRef = useRef(null);
  const toolsUsername = process.env.REACT_APP_TOOLS_SHOP_USERNAME || 'demo';
  const googleClientId = (toolsShop?.theme?.appearance?.google_client_id || '').trim();
  const telegramBotUsername = (toolsShop?.telegram_bot_username || '').trim();
  const contactSettings = toolsShop?.theme?.appearance?.public_contact || {};
  const contactEmail = contactSettings.email || 'rovistar@gmail.com';
  const contactTelegram = contactSettings.telegram || '';
  const [menuOpen, setMenuOpen] = useState(false);
  const profile = customer;

  useEffect(() => { getShop(toolsUsername).then(setToolsShop).catch(() => setProviderError('មិនអាចភ្ជាប់ប្រព័ន្ធចូលគណនីបានទេ។')); }, [toolsUsername]);
  useEffect(() => { if (toolId && !profile) setLoginOpen(true); }, [profile, toolId]);

  const finishProviderLogin = useCallback((customerProfile) => {
    setLoginOpen(false); setProviderError('');
    navigate(toolId ? `/tools/${toolId}` : '/tools', { replace: true });
    return customerProfile;
  }, [navigate, toolId]);
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
    let mounted = true; const container = googleButtonRef.current;
    if (!loginOpen || !googleClientId || !container) return undefined;
    loadGoogleIdentityServices().then(() => {
      if (!mounted || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential, auto_select: false, cancel_on_tap_outside: true });
      container.replaceChildren();
      window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', text: 'continue_with', width: Math.min(container.clientWidth || 350, 400) });
    }).catch(() => mounted && setProviderError('Google មិនអាចបើកបានទេ។'));
    return () => { mounted = false; };
  }, [googleClientId, handleGoogleCredential, loginOpen]);

  const isDashboard = location.pathname === '/tools' || location.pathname === '/';
  const start = () => { if (profile) navigate('/tools'); else setLoginOpen(true); };
  return <div className="tools-home khmer-tools-home"><header className="tools-nav"><Link to="/" className="tools-brand"><img src={rovistarAvatar} alt="ROVISTAR profile logo" /><b>ROVISTAR</b><i>TOOLS</i></Link><nav className={menuOpen ? 'is-open' : ''}><a onClick={() => setMenuOpen(false)} href={profile ? '/tools' : '#benefits'}>{profile ? 'ឧបករណ៍' : 'អត្ថប្រយោជន៍'}</a><a onClick={() => setMenuOpen(false)} href="#how-it-works">របៀបប្រើ</a></nav><button type="button" className="tools-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="បើកម៉ឺនុយ"><FiMenu /></button><div className="tools-account-actions">{profile ? <><span className="tools-user-name">{profile.avatar_url ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" /> : <FiUser />}{profile.name || profile.username || profile.email}</span><button type="button" className="tools-login-link" onClick={logout}><FiLogOut /> ចាកចេញ</button></> : <button type="button" className="tools-login-link" onClick={() => setLoginOpen(true)}><FiLogIn /> ចូលគណនី</button>}<button type="button" className="tools-nav-button" onClick={start}>{profile ? 'ផ្ទាំងឧបករណ៍' : 'ចាប់ផ្តើមប្រើ'} <FiArrowRight /></button></div></header><main>{!profile && <><section className="tools-hero"><div><p className="reference-badge"><FiZap /> ឧបករណ៍សម្រាប់ការងារប្រចាំថ្ងៃ</p><h1>ធ្វើការបាន<br /><em>ស្អាត និងលឿន</em><br />ជាងមុន។</h1><p>ROVISTAR TOOLS ជាកន្លែងតែមួយ សម្រាប់រៀបចំវីដេអូ អត្ថបទ ឯកសារ និងស្តាយឈ្មោះរបស់អ្នក។</p><div className="tools-hero-actions"><button type="button" onClick={start}>ចូលប្រើឧបករណ៍ <FiArrowRight /></button><a href="#benefits">មើលអត្ថប្រយោជន៍</a></div></div><div className="hero-board"><span>ROVISTAR</span><h2>4 Tool<br />សម្រាប់ការងារពិត</h2><div><FiVideo /><FiEdit3 /><FiFileText /><FiType /></div><small>ចូលគណនី ដើម្បីបើកប្រើ Tool ទាំងអស់</small></div></section><section id="benefits" className="tools-benefits"><div className="tools-benefits-heading"><div><span>អត្ថប្រយោជន៍</span><h2>មិនស្មុគស្មាញ។<br />តែមានប្រយោជន៍។</h2></div><p>មុនចូលគណនី អ្នកឃើញតែអត្ថប្រយោជន៍។ Tool ប្រើប្រាស់ពិត ស្ថិតនៅក្នុងផ្ទាំងគណនីរបស់អ្នក។</p></div><div className="tools-benefits-grid">{BENEFITS.map(([icon, title, copy]) => { const Icon = ICONS[icon]; return <article className="tools-benefit-card" key={title}><i><Icon /></i><h3>{title}</h3><p>{copy}</p></article>; })}</div></section></>}{profile && isDashboard && <Dashboard profile={profile} />}{profile && toolId === 'services' && <ServiceCatalog shopId={toolsShop?.id} />}{profile && toolId && toolId !== 'services' && <ToolView id={toolId} />}{!profile && <section id="how-it-works" className="tools-how"><span>01</span><div><h2>ចូលប្រើរបៀបណា?</h2><p>ចូលគណនីដោយ Google ឬ Telegram រួចជ្រើស Tool មួយ។ Tool នីមួយៗមានផ្ទាំងដាច់ដោយឡែក និងប៊ូតុងត្រឡប់ក្រោយ។</p></div><button type="button" onClick={start}>ចាប់ផ្តើមឥឡូវនេះ <FiArrowRight /></button></section>}</main><footer className="tools-footer"><div className="tools-footer-grid"><div className="tools-footer-brand"><a href="/" className="tools-brand"><img src={rovistarAvatar} alt="ROVISTAR profile logo" /><b>ROVISTAR</b><i>TOOLS</i></a><h2>Tools for Cambodia</h2><p>កន្លែងមួយសម្រាប់រៀបចំអត្ថបទ ឯកសារ វីដេអូ និងស្តាយឈ្មោះរបស់អ្នក។</p></div><div><h3>ឧបករណ៍</h3><a href="/tools/services">សេវាកម្ម និង Top up</a><a href="/tools/text-editor">កែសម្រួលអត្ថបទ</a><a href="/tools/document-studio">បង្កើតឯកសារ</a></div><div><h3>ជំនួយ</h3><a href="/tools/name-styles">ស្តាយឈ្មោះ</a><a href="/#how-it-works">របៀបប្រើប្រាស់</a><a href="/#benefits">អត្ថប្រយោជន៍</a></div><div><h3>ទំនាក់ទំនង</h3><a href={`mailto:${contactEmail}`} className="footer-email">{contactEmail}</a>{contactTelegram && <a href={`https://t.me/${contactTelegram.replace(/^@/, '')}`}>Telegram: {contactTelegram}</a>}<p>គណនីអ្នកប្រើត្រូវបានការពារដោយការចូល Google ឬ Telegram ផ្លូវការ។</p></div></div><div className="tools-footer-bottom"><span>© 2026 ROVISTAR TOOLS</span><span><a href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a><a href="https://tiktok.com" target="_blank" rel="noreferrer">TikTok</a></span></div></footer>{loginOpen && <LoginModal close={() => { setLoginOpen(false); if (toolId) navigate('/'); }} googleClientId={googleClientId} googleButtonRef={googleButtonRef} telegramBotUsername={telegramBotUsername} onTelegramAuth={handleTelegramAuth} busy={providerBusy} error={providerError} />}</div>;
}

function LoginModal({ close, googleClientId, googleButtonRef, telegramBotUsername, onTelegramAuth, busy, error }) {
  return <div className="tools-login-backdrop" role="presentation" onMouseDown={close}><section className="tools-login-modal tools-provider-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="tools-modal-close" onClick={close} aria-label="បិទ"><FiX /></button><div className="tools-login-icon"><FiLock /></div><p>គណនី ROVISTAR TOOLS</p><h2>ចូលគណនីដោយសុវត្ថិភាព</h2><span>ជ្រើសរើស Google ឬ Telegram របស់អ្នក។ ឈ្មោះ អ៊ីមែល និងរូបភាព Profile នឹងមកពីគណនីដែលអ្នកជ្រើសរើសដោយផ្ទាល់។</span>{error && <em className="tools-provider-error">{error}</em>}<div className="tools-provider-options"><div className="tools-provider-option"><div className="tools-provider-heading"><FcGoogle /><div><b>បន្តជាមួយ Google</b><small>ប្រើ Gmail និងរូបភាព Profile ពិតរបស់អ្នក</small></div></div>{googleClientId ? <div ref={googleButtonRef} className="tools-google-button" /> : <div className="tools-provider-pending">កំពុងរៀបចំ Google Sign-In</div>}</div><div className="tools-provider-divider"><span>ឬ</span></div><div className="tools-provider-option"><div className="tools-provider-heading tools-telegram-heading"><FaTelegramPlane /><div><b>បន្តជាមួយ Telegram</b><small>ប្រើឈ្មោះ Username និងរូបភាព Profile ពិតរបស់អ្នក</small></div></div>{telegramBotUsername ? <TelegramLogin botUsername={telegramBotUsername} onAuth={onTelegramAuth} label="Telegram មិនទាន់រៀបចំ" /> : <div className="tools-provider-pending">កំពុងរៀបចំ Telegram Sign-In</div>}</div></div>{busy && <small className="tools-provider-loading">កំពុងផ្ទៀងផ្ទាត់គណនីរបស់អ្នក...</small>}<small>ROVISTAR TOOLS មិនស្នើសុំពាក្យសម្ងាត់ Google ឬ Telegram របស់អ្នកទេ។</small></section></div>;
}
