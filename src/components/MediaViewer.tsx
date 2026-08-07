"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";

interface MediaViewerProps {
  type: string;
  driveUrl: string | null;
  title: string;
}

function driveFileId(url: string): string | null {
  const match = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const STEP_ZOOM = 0.5;
const DOUBLE_CLICK_ZOOM = 2.5;

export default function MediaViewer({ type, driveUrl, title }: MediaViewerProps) {
  const { t } = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lightboxTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; dragging: boolean }>({
    startX: 0, startY: 0, panX: 0, panY: 0, dragging: false,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fileId = driveUrl ? driveFileId(driveUrl) : null;
  const imageUrl = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w2400` : null;
  const directUrl = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : null;
  const previewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;

  useEffect(() => {
    setVideoFailed(false);
    setImageFailed(false);
    setLightboxOpen(false);
  }, [driveUrl, type]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (lightboxOpen && dialog && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    }
  }, [lightboxOpen]);

  // Reset zoom/pan whenever the lightbox opens or closes
  useEffect(() => {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }, [lightboxOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    dialog?.addEventListener("fullscreenchange", onFullscreenChange);
    return () => dialog?.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function closeLightbox() {
    dialogRef.current?.close();
  }

  function handleDialogClose() {
    setLightboxOpen(false);
    setPan({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    lightboxTriggerRef.current?.focus();
  }

  function toggleFullscreen() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      dialog.requestFullscreen?.().catch(() => {});
    }
  }

  function resetView() {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }

  function handleWheel(e: React.WheelEvent) {
    if (zoom <= MIN_ZOOM && e.deltaY < 0) {
      // zooming in from 1x is always allowed
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + STEP_ZOOM)));
      return;
    }
    e.preventDefault();
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + (e.deltaY > 0 ? -STEP_ZOOM : STEP_ZOOM))));
    if (zoom > MIN_ZOOM) {
      // keep zoom centered-ish: no-op here; pan is manual
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (zoom <= MIN_ZOOM) return;
    const drag = dragRef.current;
    drag.dragging = true;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.panX = pan.x;
    drag.panY = pan.y;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag.dragging || zoom <= MIN_ZOOM) return;
    setPan({
      x: drag.panX + (e.clientX - drag.startX),
      y: drag.panY + (e.clientY - drag.startY),
    });
  }

  function handlePointerUp(e: React.PointerEvent) {
    dragRef.current.dragging = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  function handleDoubleClick() {
    if (zoom > MIN_ZOOM) {
      resetView();
    } else {
      setZoom(DOUBLE_CLICK_ZOOM);
      setPan({ x: 0, y: 0 });
    }
  }

  const unavailable = !fileId || (type !== "video" && type !== "screenshot");

  return (
    <>
      <div
        className="relative flex h-[clamp(16rem,40vh,28rem)] min-h-[16rem] sm:h-[clamp(28rem,72vh,60rem)] sm:min-h-[28rem] w-full items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-[#f4f4f6] p-4 shadow-inner sm:p-6"
      >
        {unavailable ? (
          <div className="px-6 text-center text-sm text-white/70" role="status">{t("mv.unavailable")}</div>
        ) : type === "video" ? (
          videoFailed && previewUrl ? (
            <iframe
              src={previewUrl}
              className="h-full w-full border-0"
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              title={`${title} video preview`}
            />
          ) : (
            <video
              controls
              preload="metadata"
              src={directUrl || undefined}
              onError={() => setVideoFailed(true)}
              className="h-full w-full object-contain"
              aria-label={title}
            >
              {t("mv.noVideoSupport")}
            </video>
          )
        ) : imageUrl && !imageFailed ? (
          <button
            ref={lightboxTriggerRef}
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="flex h-full w-full cursor-zoom-in items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
            aria-label={t("mv.openViewer", { name: title })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={title} referrerPolicy="no-referrer" onError={() => setImageFailed(true)} className="h-full w-full object-contain" />
          </button>
        ) : (
          <div className="px-6 text-center text-sm text-white/70" role="status">{t("mv.unavailable")}</div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        onClose={handleDialogClose}
        onClick={(event) => { if (event.target === event.currentTarget) closeLightbox(); }}
        aria-label={`${title} image viewer`}
        className="m-0 h-screen max-h-none w-screen max-w-none bg-black/95 p-0 text-white backdrop:bg-black/95"
      >
        <div
          className="relative flex h-full w-full items-center justify-center overflow-hidden p-4 sm:p-8"
          onWheel={handleWheel}
        >
          {/* Controls */}
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2 sm:right-4 sm:top-4">
            {zoom > MIN_ZOOM && (
              <button
                type="button"
                onClick={resetView}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-black/75 text-white hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label={t("mv.resetZoom")}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0114-4.9M20 14a8 8 0 01-14 4.9" /></svg>
              </button>
            )}
            {directUrl && (
              <a
                href={directUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-black/75 text-white hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label={t("mv.download")}
                title={t("mv.download")}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              </a>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-black/75 text-white hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label={isFullscreen ? t("mv.exitFullscreen") : t("mv.openFullscreen")}
            >
              {isFullscreen ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" /></svg>
              )}
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeLightbox}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-black/75 text-white hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label={t("mv.closeViewer")}
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>

          {/* Zoom indicator */}
          {zoom > MIN_ZOOM && (
            <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-black/75 px-3 py-1 text-xs font-semibold text-white">
              {t("mv.dragToPan", { zoom: Math.round(zoom * 100) })}
            </div>
          )}

          {imageUrl && (
            <div
              className={`h-full w-full flex items-center justify-center overflow-hidden ${zoom > MIN_ZOOM ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onDoubleClick={handleDoubleClick}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={title}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain select-none"
                draggable={false}
                style={{
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                  transition: zoom === MIN_ZOOM ? "transform 0.15s ease-out" : "none",
                }}
              />
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
