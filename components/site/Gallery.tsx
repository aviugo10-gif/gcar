"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";

type Ph = { src: string; w?: number; h?: number };
export function Gallery({ photos, title }: { photos: Ph[]; title: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [full, setFull] = useState<number | null>(null);
  const onScroll = () => {
    const t = track.current;
    if (t) setI(Math.round(Math.abs(t.scrollLeft) / t.clientWidth));
  };
  const go = (n: number) => {
    const t = track.current;
    if (!t) return;
    // RTL: scrollLeft runs negative in modern browsers
    t.scrollTo({ left: -n * t.clientWidth, behavior: "smooth" });
  };
  if (!photos.length) return <div className="gallery" style={{ aspectRatio: "4/3", display: "grid", placeItems: "center" }}><Icon name="image" size="lg" /></div>;
  return (
    <div>
      <div className="gallery">
        <div className="gallery__track" ref={track} onScroll={onScroll} aria-roledescription="גלריה" aria-label={`תמונות של ${title}`}>
          {photos.map((p, n) => (
            <button key={p.src} className="gallery__slide" onClick={() => setFull(n)} aria-label={`תמונה ${n + 1} מתוך ${photos.length}, פתיחה במסך מלא`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="photo" src={p.src} alt="" width={p.w} height={p.h} loading={n === 0 ? "eager" : "lazy"} />
            </button>
          ))}
        </div>
        <span className="gc-vcard__count gallery__count gc-num">{i + 1}/{photos.length}</span>
      </div>
      {photos.length > 1 && (
        <div className="gallery__thumbs">
          {photos.map((p, n) => (
            <button key={p.src} aria-current={n === i} aria-label={`תמונה ${n + 1}`} onClick={() => go(n)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="photo" src={p.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {full !== null && <Lightbox photos={photos} start={full} onClose={() => setFull(null)} />}
    </div>
  );
}

function Lightbox({ photos, start, onClose }: { photos: Ph[]; start: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const y0 = useRef<number | null>(null);
  useEffect(() => {
    const t = ref.current;
    if (t) t.scrollLeft = -start * t.clientWidth;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [start, onClose]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="תמונות במסך מלא"
      onTouchStart={(e) => (y0.current = e.touches[0].clientY)}
      onTouchEnd={(e) => { if (y0.current !== null && e.changedTouches[0].clientY - y0.current > 120) onClose(); y0.current = null; }}>
      <button className="gc-btn gc-btn--icon lightbox__close" onClick={onClose} aria-label="סגירה" autoFocus><Icon name="x" /></button>
      <div className="lightbox__track" ref={ref}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photos.map((p) => <img key={p.src} src={p.src} alt="" />)}
      </div>
    </div>
  );
}
