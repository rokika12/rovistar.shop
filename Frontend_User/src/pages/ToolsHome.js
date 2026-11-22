import React, { useMemo, useState } from 'react';
import './ToolsHome.css';
import {
  FiArrowRight, FiCheckCircle, FiCode, FiCopy, FiFileText, FiImage, FiLink,
  FiLock, FiMusic, FiPlay, FiSearch, FiSliders, FiVideo, FiX, FiZap,
} from 'react-icons/fi';

const TOOLS = [
  { id: 'video', icon: FiVideo, category: 'VIDEO', title: 'Video Studio', copy: 'Import your own media, plan formats, and prepare a job.', state: 'AUTHORIZED MEDIA' },
  { id: 'json', icon: FiCode, category: 'DEVELOPER', title: 'JSON Formatter', copy: 'Format, validate, and clean JSON in your browser.', state: 'READY NOW' },
  { id: 'text', icon: FiFileText, category: 'TEXT', title: 'Text Transformer', copy: 'Clean, convert, and reshape text instantly.', state: 'READY NOW' },
  { id: 'password', icon: FiLock, category: 'SECURITY', title: 'Password Forge', copy: 'Generate strong passwords without sending data anywhere.', state: 'READY NOW' },
  { id: 'url', icon: FiLink, category: 'DEVELOPER', title: 'URL Encoder', copy: 'Encode or decode URLs and query-string values.', state: 'READY NOW' },
  { id: 'image', icon: FiImage, category: 'IMAGE', title: 'Image Lab', copy: 'Resize, convert, compress, and remove backgrounds.', state: 'NEXT' },
  { id: 'audio', icon: FiMusic, category: 'AUDIO', title: 'Audio Lab', copy: 'Extract audio, transcribe, clean noise, and export captions.', state: 'NEXT' },
];

const CATEGORIES = ['ALL', 'VIDEO', 'IMAGE', 'AUDIO', 'TEXT', 'DEVELOPER', 'SECURITY'];

function copyText(value) {
  if (navigator.clipboard) navigator.clipboard.writeText(value);
}

export default function ToolsHome() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [activeTool, setActiveTool] = useState('video');
  const [source, setSource] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [jsonInput, setJsonInput] = useState('{\n  "hello": "ROVISTAR TOOLS"\n}');
  const [jsonOutput, setJsonOutput] = useState('');
  const [textInput, setTextInput] = useState('Make your work faster with ROVISTAR TOOLS');
  const [textOutput, setTextOutput] = useState('');
  const [urlInput, setUrlInput] = useState('https://rovistar.shop/?tool=video studio');
  const [urlOutput, setUrlOutput] = useState('');
  const [password, setPassword] = useState('');

  const shownTools = useMemo(() => TOOLS.filter((tool) => {
    const matchesCategory = category === 'ALL' || tool.category === category;
    const haystack = `${tool.title} ${tool.copy} ${tool.category}`.toLowerCase();
    return matchesCategory && haystack.includes(query.toLowerCase());
  }), [category, query]);

  const active = TOOLS.find((tool) => tool.id === activeTool) || TOOLS[0];
  const selectTool = (tool) => {
    setActiveTool(tool.id);
    document.getElementById('workbench')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const generatePassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
    const values = new Uint32Array(18);
    crypto.getRandomValues(values);
    setPassword(Array.from(values, (value) => alphabet[value % alphabet.length]).join(''));
  };

  return (
    <div className="tools-home">
      <div className="tools-noise" aria-hidden="true" />
      <header className="tools-nav">
        <a href="/" className="tools-brand"><span>R</span><b>ROVISTAR</b><i>TOOLS</i></a>
        <nav><a href="#tools">Explore tools</a><a href="#workbench">Workbench</a><a href="#roadmap">Roadmap</a></nav>
        <button type="button" className="tools-nav-button" onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })}>Open toolbox <FiArrowRight /></button>
      </header>

      <main>
        <section className="tools-hero">
          <div className="tools-hero-copy">
            <p className="tools-eyebrow"><FiZap /> A CREATOR AND PRODUCTIVITY UTILITY LAB</p>
            <h1>One sharp <em>toolbox.</em><br />No noisy workflow.</h1>
            <p className="tools-hero-lede">Turn files, ideas and repetitive work into finished output. Start with the fast browser tools, then bring your own media into the studio.</p>
            <div className="tools-hero-actions"><button type="button" onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })}>Explore tools <FiArrowRight /></button><a href="#workbench">Try a tool now</a></div>
            <div className="tools-hero-proof"><span><b>05</b> live browser tools</span><span><b>03</b> creator labs next</span><span><b>0</b> files sent for text tools</span></div>
          </div>
          <div className="tools-signal-board" aria-label="Tool platform preview">
            <div className="tools-board-top"><span>WORKSPACE / 01</span><i>ONLINE</i></div>
            <div className="tools-board-orbit"><span className="orbit-core"><FiZap /></span><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" /></div>
            <div className="tools-board-stream"><span>VIDEO IMPORT</span><b>Authorized source ready</b><small>Bring a file or a permitted link.</small></div>
            <div className="tools-board-bottom"><span>FORMAT</span><b>MP4 / MP3 / SRT</b><span>QUEUE</span><b>01</b></div>
          </div>
        </section>

        <section className="tools-directory" id="tools">
          <div className="tools-directory-heading"><div><p className="tools-eyebrow">TOOL DIRECTORY</p><h2>Pick a task. Make progress.</h2></div><p>Useful utilities first. Heavy media workflows follow with permission-aware imports.</p></div>
          <div className="tools-filter-row"><div className="tools-search"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a tool" />{query && <button type="button" onClick={() => setQuery('')}><FiX /></button>}</div><div className="tools-categories">{CATEGORIES.map((item) => <button key={item} type="button" className={item === category ? 'is-active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
          <div className="tools-card-grid">{shownTools.map((tool, index) => { const Icon = tool.icon; return <article key={tool.id} className={`tools-card tools-card-${index % 4}`}><div className="tools-card-mark"><Icon /></div><span>{tool.category}</span><h3>{tool.title}</h3><p>{tool.copy}</p><div><small className={tool.state === 'READY NOW' ? 'is-ready' : ''}>{tool.state}</small><button type="button" onClick={() => selectTool(tool)}>Open <FiArrowRight /></button></div></article>; })}</div>
        </section>

        <section className="tools-workbench" id="workbench">
          <div className="tools-workbench-sidebar"><p className="tools-eyebrow">LIVE WORKBENCH</p><h2>{active.title}</h2><p>{active.copy}</p><div className="tools-mini-list">{TOOLS.slice(0, 5).map((tool) => <button key={tool.id} type="button" className={tool.id === activeTool ? 'is-active' : ''} onClick={() => setActiveTool(tool.id)}>{tool.title}<FiArrowRight /></button>)}</div></div>
          <div className="tools-workbench-panel">
            {activeTool === 'video' && <div className="tools-panel-content"><div className="tools-panel-title"><FiVideo /><div><span>AUTHORIZED VIDEO IMPORT</span><h3>Bring your own media into the queue.</h3></div></div><label className="tools-file-drop"><input type="file" accept="video/*,audio/*" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} /><FiPlay /><b>{selectedFile ? selectedFile.name : 'Choose a video or audio file'}</b><small>{selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB selected` : 'Your file stays local until you explicitly start a media job.'}</small></label><div className="tools-or">OR USE A PERMITTED DIRECT FILE URL</div><input className="tools-input" value={source} onChange={(event) => setSource(event.target.value)} placeholder="https://your-file-host.example/video.mp4" /><p className="tools-panel-note"><FiCheckCircle /> Use content you own or are authorized to process. Platform-restricted links are not extracted.</p></div>}
            {activeTool === 'json' && <div className="tools-panel-content"><div className="tools-panel-title"><FiCode /><div><span>DEVELOPER UTILITY</span><h3>Format and validate JSON.</h3></div></div><textarea value={jsonInput} onChange={(event) => setJsonInput(event.target.value)} className="tools-textarea" spellCheck="false" /><div className="tools-panel-actions"><button type="button" onClick={() => { try { setJsonOutput(JSON.stringify(JSON.parse(jsonInput), null, 2)); } catch (error) { setJsonOutput(`Invalid JSON: ${error.message}`); } }}>Format JSON <FiArrowRight /></button>{jsonOutput && <button type="button" className="tools-copy" onClick={() => copyText(jsonOutput)}><FiCopy /> Copy</button>}</div>{jsonOutput && <pre className="tools-output">{jsonOutput}</pre>}</div>}
            {activeTool === 'text' && <div className="tools-panel-content"><div className="tools-panel-title"><FiFileText /><div><span>TEXT UTILITY</span><h3>Transform text instantly.</h3></div></div><textarea value={textInput} onChange={(event) => setTextInput(event.target.value)} className="tools-textarea" /><div className="tools-transform-row"><button type="button" onClick={() => setTextOutput(textInput.toUpperCase())}>UPPERCASE</button><button type="button" onClick={() => setTextOutput(textInput.toLowerCase())}>lowercase</button><button type="button" onClick={() => setTextOutput(textInput.replace(/\s+/g, ' ').trim())}>Clean spaces</button></div>{textOutput && <div className="tools-output tools-plain-output">{textOutput}<button type="button" onClick={() => copyText(textOutput)}><FiCopy /></button></div>}</div>}
            {activeTool === 'password' && <div className="tools-panel-content"><div className="tools-panel-title"><FiLock /><div><span>SECURITY UTILITY</span><h3>Create a strong local password.</h3></div></div><div className="tools-password-orb"><FiLock /></div><button type="button" className="tools-primary-action" onClick={generatePassword}>Generate password <FiZap /></button>{password && <div className="tools-output tools-plain-output"><code>{password}</code><button type="button" onClick={() => copyText(password)}><FiCopy /></button></div>}</div>}
            {activeTool === 'url' && <div className="tools-panel-content"><div className="tools-panel-title"><FiLink /><div><span>DEVELOPER UTILITY</span><h3>Encode or decode a URL.</h3></div></div><textarea value={urlInput} onChange={(event) => setUrlInput(event.target.value)} className="tools-textarea" /><div className="tools-transform-row"><button type="button" onClick={() => setUrlOutput(encodeURIComponent(urlInput))}>Encode</button><button type="button" onClick={() => { try { setUrlOutput(decodeURIComponent(urlInput)); } catch { setUrlOutput('This value cannot be decoded.'); } }}>Decode</button></div>{urlOutput && <div className="tools-output tools-plain-output">{urlOutput}<button type="button" onClick={() => copyText(urlOutput)}><FiCopy /></button></div>}</div>}
            {['image', 'audio'].includes(activeTool) && <div className="tools-panel-content tools-coming"><FiSliders /><span>UP NEXT</span><h3>{active.title} is on the next build queue.</h3><p>It will include safe file import, browser-first processing, and an export history.</p><button type="button" onClick={() => setActiveTool('video')}>Try Video Studio <FiArrowRight /></button></div>}
          </div>
        </section>

        <section className="tools-roadmap" id="roadmap"><div><p className="tools-eyebrow">THE NEXT BUILD</p><h2>Designed to become your daily operating desk.</h2></div><ol><li><b>01</b><span><strong>Media jobs</strong>Convert, compress, captions, and exports for owned or authorized media.</span></li><li><b>02</b><span><strong>File workspace</strong>Private history, reusable presets, and safe deletion controls.</span></li><li><b>03</b><span><strong>Khmer AI utilities</strong>Translate, summarize, captions, and cleaner business writing.</span></li></ol></section>
      </main>
      <footer className="tools-footer"><span>ROVISTAR TOOLS / BUILT FOR USEFUL WORK</span><span>Use content and files you have the right to process.</span></footer>
    </div>
  );
}
