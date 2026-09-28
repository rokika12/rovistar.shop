import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiShoppingBag } from 'react-icons/fi';
import { useLanguage } from '../i18n';
import { fullUrl } from '../api';

/**
 * Lightweight, dependency-free slideshow banner.
 * Always shows exactly ONE image at a time (absolute stacked slides + fade),
 * so it never duplicates under React StrictMode. Auto-plays with arrows + dots.
 * Full width and full height responsive layout. Images fill the frame so the
 * admin-selected banner does not leave blurred side panels.
 */
export default function Slideshow({ slides }) {
  const { t } = useLanguage();
  const images = useMemo(() => slides || [], [slides]);
  const count = images.length;
  const [index, setIndex] = useState(0);
  const [failedSlides, setFailedSlides] = useState(() => new Set());
  const touchStart = useRef(null);
  const timerRef = useRef(null);

  const goTo = useCallback((i) => {
    if (count === 0) return;
    setIndex(((i % count) + count) % count);
  }, [count]);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  const handleTouchStart = (event) => {
    touchStart.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    if (touchStart.current === null || count < 2) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(distance) < 40) return;
    if (distance < 0) next();
    else prev();
  };

  useEffect(() => {
    setIndex(0);
    setFailedSlides(new Set());
  }, [images]);

  useEffect(() => {
    if (count <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [count]);

  if (count === 0) {
    return (
      <div className="w-full h-56 md:h-80 bg-gradient-to-r from-primary to-secondary flex items-center justify-center overflow-hidden">
        <span className="text-white text-2xl font-bold flex items-center gap-3">
          <FiShoppingBag className="w-8 h-8" /> {t('welcome')}
        </span>
      </div>
    );
  }

  return (
    <div
      className="relative w-full aspect-[3/1] min-h-[132px] max-h-[520px] md:min-h-[180px] overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {images.map((img, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Keep a designed fallback instead of exposing broken-image alt text. */}
          {failedSlides.has(i) ? (
            <div className="w-full h-full bg-gradient-to-br from-blue-700 via-blue-600 to-sky-400 flex items-end p-4 sm:p-7 text-white">
              <div><span className="text-[10px] sm:text-xs font-black tracking-[0.16em]">ROVISTAR</span><p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-black">New arrivals</p></div>
            </div>
          ) : (
            <img
              src={fullUrl(img)}
              alt=""
              className="w-full h-full object-cover relative z-10"
              onError={() => setFailedSlides((current) => new Set([...current, i]))}
            />
          )}
        </div>
      ))}

      {/* Arrows */}
      {count > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition z-20"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition z-20"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {count > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`w-2.5 h-2.5 rounded-full transition ${
                i === index ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
