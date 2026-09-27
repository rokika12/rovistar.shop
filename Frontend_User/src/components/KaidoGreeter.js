import React, { useEffect, useState } from 'react';
import { FiArrowUp, FiSend } from 'react-icons/fi';
import { useShop } from '../contexts/ShopContext';

function getTelegramUrl(shop) {
  const rawLink = shop.social_media?.telegram
    || (typeof shop.contact === 'string' && shop.contact.includes('t.me') ? shop.contact : '');
  const link = String(rawLink || '').trim();

  if (/^https?:\/\//i.test(link)) return link;
  if (/^t\.me\//i.test(link)) return `https://${link}`;
  if (/^@[A-Za-z0-9_]+$/.test(link)) return `https://t.me/${link.slice(1)}`;
  return '';
}

export default function KaidoGreeter() {
  const { shop } = useShop();
  const supportUrl = getTelegramUrl(shop);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setShowBackToTop(window.scrollY > 360);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const content = (
    <>
      <span className="kaido-greeter-bubble">សួស្តី! ត្រូវការជំនួយទេ?</span>
      <span className="kaido-greeter-mascot" aria-hidden="true">
        <span className="kaido-greeter-ear kaido-greeter-ear-left" />
        <span className="kaido-greeter-ear kaido-greeter-ear-right" />
        <span className="kaido-greeter-face"><i /><i /><b /></span>
        <span className="kaido-greeter-shirt">K</span>
      </span>
      {supportUrl && <span className="kaido-greeter-send"><FiSend /></span>}
    </>
  );

  return (
    <>
      {supportUrl ? (
      <a className="kaido-greeter" href={supportUrl} target="_blank" rel="noreferrer" aria-label="Chat with Kaido Store support on Telegram">
        {content}
      </a>
      ) : <div className="kaido-greeter" aria-label="Kaido Store greeting">{content}</div>}
      <div className="kaido-quick-controls">
        {supportUrl && <a href={supportUrl} target="_blank" rel="noreferrer" className="kaido-telegram-control" aria-label="Open Kaido Store Telegram"><FiSend /></a>}
        {showBackToTop && <button type="button" onClick={scrollToTop} className="kaido-back-top" aria-label="Back to top"><FiArrowUp /></button>}
      </div>
    </>
  );
}
