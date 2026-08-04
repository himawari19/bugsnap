"use client";

import { useEffect, useRef, useState } from "react";

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

function ActionIcon({ children }: { children: React.ReactNode }) {
  return <span className="h-5 w-5" aria-hidden="true">{children}</span>;
}

export default function MediaViewer({ type, driveUrl, title }: MediaViewerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lightboxTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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
    const updateFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (lightboxOpen && dialog && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    }
  }, [lightboxOpen]);

  function closeLightbox() {
    dialogRef.current?.close();
  }

  function handleDialogClose() {
    setLightboxOpen(false);
    lightboxTriggerRef.current?.focus();
  }

  async function toggleFullscreen(target: HTMLElement | null) {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await target?.requestFullscreen();
    } catch {
      // Fullscreen can be denied by browser or embedding policy; native controls remain usable.
    }
  }

  const actions = (inDialog = false) => (
    <div className={inDialog ? "flex items-center gap-2" : "absolute right-3 top-3 z-10 flex items-center gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"}>
      {directUrl && (
        <a
          href={directUrl}
          download
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg bg-black/75 px-3 text-sm font-medium text-white shadow-lg backdrop-blur hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Download capture"
          title="Download"
        >
          <ActionIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14" /></svg></ActionIcon>
          <span className="hidden sm:inline">Download</span>
        </a>
      )}
      <button
        type="button"
        onClick={() => toggleFullscreen(inDialog ? dialogRef.current : stageRef.current)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg bg-black/75 px-3 text-sm font-medium text-white shadow-lg backdrop-blur hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        <ActionIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5m13 5h5v-5" /></svg></ActionIcon>
        <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
      </button>
      {driveUrl && (
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg bg-black/75 px-3 text-sm font-medium text-white shadow-lg backdrop-blur hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Open capture in Google Drive"
          title="Open in Drive"
        >
          <ActionIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 5h5v5M10 14 19 5M19 14v5H5V5h5" /></svg></ActionIcon>
          <span className="hidden sm:inline">Open Drive</span>
        </a>
      )}
    </div>
  );

  const unavailable = !fileId || (type !== "video" && type !== "screenshot");

  return (
    <>
      <div
        ref={stageRef}
        className="group relative flex h-[clamp(20rem,60vh,52rem)] min-h-[20rem] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#111214] shadow-inner"
      >
        {!unavailable && actions()}
        {unavailable ? (
          <div className="px-6 text-center text-sm text-white/70" role="status">Preview unavailable</div>
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
              Your browser does not support video playback.
            </video>
          )
        ) : imageUrl && !imageFailed ? (
          <button
            ref={lightboxTriggerRef}
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="flex h-full w-full cursor-zoom-in items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
            aria-label={`Open ${title} in image viewer`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={title} referrerPolicy="no-referrer" onError={() => setImageFailed(true)} className="h-full w-full object-contain" />
          </button>
        ) : (
          <div className="px-6 text-center text-sm text-white/70" role="status">Preview unavailable</div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        onClose={handleDialogClose}
        onClick={(event) => { if (event.target === event.currentTarget) closeLightbox(); }}
        aria-label={`${title} image viewer`}
        className="m-0 h-screen max-h-none w-screen max-w-none bg-black/95 p-0 text-white backdrop:bg-black/95"
      >
        <div className="relative flex h-full w-full items-center justify-center p-4 sm:p-8">
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2 sm:right-4 sm:top-4">
            {actions(true)}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeLightbox}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-black/75 text-white hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Close image viewer"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={title} referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
          )}
        </div>
      </dialog>
    </>
  );
}
