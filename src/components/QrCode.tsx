"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

/**
 * QR code renderer backed by the battle-tested `qrcode` library.
 * Renders to canvas locally — no network, no external service.
 */
export default function QrCode({ value, size = 128 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {
      // Never break the modal if generation fails for some edge case.
    });
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-xl border border-border shadow-sm"
      aria-label="QR code"
    />
  );
}
