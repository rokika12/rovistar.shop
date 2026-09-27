import React, { useEffect, useState } from 'react';
import { FiArrowUp } from 'react-icons/fi';

export default function KaidoGreeter() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setShowBackToTop(window.scrollY > 360);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  return (
    showBackToTop ? <div className="kaido-quick-controls"><button type="button" onClick={scrollToTop} className="kaido-back-top" aria-label="Back to top"><FiArrowUp /></button></div> : null
  );
}
