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

export default function MediaViewer({ type, driveUrl, title }: MediaViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lightboxTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  function closeLightbox() {
    dialogRef.current?.close();
  }

  function handleDialogClose() {
    setLightboxOpen(false);
    lightboxTriggerRef.current?.focus();
  }

  const unavailable = !fileId || (type !== "video" && type !== "screenshot");

  return (
    <>
      <div
        className="relative flex h-[clamp(16rem,40vh,28rem)] min-h-[16rem] sm:h-[clamp(28rem,72vh,60rem)] sm:min-h-[28rem] w-full items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-[#f4f4f6] p-4 shadow-inner sm:p-6"
      >
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
          <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
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
