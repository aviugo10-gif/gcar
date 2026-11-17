"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "../Icon";
import { useToast } from "./Toast";
import { savePhotos, removePhoto, photoUploadUrl, attachPhoto } from "@/app/admin/actions";
import { compressImage } from "@/lib/image";
import { PHOTO_BASE } from "@/lib/env";
import type { Vehicle, Photo } from "@/lib/types";

/** Drag by the handle to reorder, star = main photo (first on the site), eye = show on the site. Saves on every change. */
export function PhotosTab({ v }: { v: Vehicle }) {
  const router = useRouter();
  const toast = useToast();
  const [photos, setPhotos] = useState<Photo[]>(() => [...v.photos].sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.sort - b.sort));
  const [drag, setDrag] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  async function persist(next: Photo[]) {
    const withSort = next.map((p, i) => ({ ...p, sort: i }));
    setPhotos(withSort);
    const r = await savePhotos(v.id, withSort.map(({ id, sort, is_main, show_on_site }) => ({ id, sort, is_main, show_on_site })));
    if (!r.ok) toast(r.error);
  }
  const setMain = (id: string) => persist([photos.find((p) => p.id === id)!, ...photos.filter((p) => p.id !== id)].map((p) => ({ ...p, is_main: p.id === id, show_on_site: p.id === id ? true : p.show_on_site })));
  const toggle = (id: string) => persist(photos.map((p) => (p.id === id ? { ...p, show_on_site: !p.show_on_site } : p)));
  async function del(p: Photo) {
    setPhotos((x) => x.filter((y) => y.id !== p.id));
    await removePhoto(v.id, p.id);
    toast("התמונה נמחקה");
    router.refresh();
  }
  async function add(files: FileList) {
    setUploading(files.length);
    for (const f of [...files]) {
      const blob = await compressImage(f); // strips location/EXIF, max 1600px
      const u = await photoUploadUrl(v.id);
      if (!u.ok) { toast("ההעלאה נכשלה"); break; }
      if (!u.data!.demo) {
        const put = await fetch(u.data!.url, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: blob });
        if (!put.ok) { toast("ההעלאה נכשלה"); break; }
      }
      const img = await createImageBitmap(blob).catch(() => null);
      await attachPhoto(v.id, u.data!.path, img?.width, img?.height);
      setUploading((n) => n - 1);
    }
    setUploading(0);
    router.refresh();
    location.reload(); // pick up server ids for the new photos
  }

  // pointer drag: works with mouse and touch; the grid stays scrollable because only the handle starts a drag
  function onMove(e: React.PointerEvent) {
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-pid]");
    const over = el?.dataset.pid;
    if (!over || over === drag) return;
    setPhotos((ps) => {
      const from = ps.findIndex((p) => p.id === drag), to = ps.findIndex((p) => p.id === over);
      const n = [...ps];
      n.splice(to, 0, n.splice(from, 1)[0]);
      return n;
    });
  }
  function onUp() {
    if (!drag) return;
    setDrag(null);
    persist(photos.map((p, i) => ({ ...p, is_main: i === 0 })));
  }

  return (
    <div className="gc-stack" style={{ gap: 16 }}>
      <div className="row-between"><span className="t-caption">{photos.length} תמונות · {photos.filter((p) => p.show_on_site).length} באתר · גוררים מהידית לסידור</span></div>
      <div className="photo-grid" ref={grid} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {photos.map((p, i) => (
          <div key={p.id} className="photo-tile" data-pid={p.id} data-dragging={drag === p.id ? "" : undefined}>
            <img className="photo" src={PHOTO_BASE + p.path} alt={`תמונה ${i + 1}`} draggable={false} style={{ opacity: p.show_on_site ? 1 : 0.45 }} />
            {i === 0 && <span className="gc-tag gc-tag--first photo-tile__hidden">ראשית</span>}
            {!p.show_on_site && i !== 0 && <span className="gc-tag gc-tag--glass photo-tile__hidden">מוסתרת</span>}
            <button className="photo-tile__grip" aria-label="גרירה לסידור" onPointerDown={(e) => { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); setDrag(p.id); }}><Icon name="grip" size="sm" /></button>
            <div className="photo-tile__bar">
              <button aria-pressed={p.is_main || i === 0} aria-label="תמונה ראשית" onClick={() => setMain(p.id)}><Icon name="star" size="sm" /></button>
              <button aria-pressed={!p.show_on_site} aria-label={p.show_on_site ? "הסתרה מהאתר" : "הצגה באתר"} onClick={() => toggle(p.id)}><Icon name={p.show_on_site ? "eye" : "eye-off"} size="sm" /></button>
              <button aria-label="מחיקה" onClick={() => del(p)}><Icon name="trash" size="sm" /></button>
            </div>
          </div>
        ))}
        <button className="shot" onClick={() => input.current?.click()} disabled={uploading > 0}><Icon name={uploading ? "upload" : "camera"} />{uploading ? `מעלה ${uploading}…` : "הוספה"}</button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files?.length && add(e.target.files)} />
      <div className="alert alert--info"><Icon name="image" />התמונות מוקטנות ונמחק מהן מידע המיקום לפני ההעלאה. מומלץ: חזית באלכסון, צד, אחור, תא נוסעים, לוח מחוונים ותא מטען.</div>
    </div>
  );
}
