"use client";

import { useMemo } from "react";
import { encode } from "uqr";

/**
 * A QR code drawn as one SVG path, rendered locally: the otpauth URI (which
 * carries the TOTP secret) never leaves the browser for a QR service.
 * Dark modules are ink on a white quiet zone in both themes, since phone
 * cameras read dark-on-light best. The three finder eyes are drawn as rounded
 * squares so the code sits in the console's style without hurting scans.
 */
export function QrCode({ value, size = 196, label = "QR code" }: { value: string; size?: number; label?: string }) {
  const { n, path, eyes } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 0 });
    const n = qr.size;
    const isEye = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    let d = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.data[y][x] && !isEye(x, y)) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { n, path: d, eyes: [[0, 0], [n - 7, 0], [0, n - 7]] as const };
  }, [value]);
  const q = 3; // quiet zone in modules
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`${-q} ${-q} ${n + q * 2} ${n + q * 2}`}
      shapeRendering="crispEdges"
      className="block rounded-md"
    >
      <rect x={-q} y={-q} width={n + q * 2} height={n + q * 2} fill="#ffffff" />
      <path d={path} fill="#141821" />
      {eyes.map(([x, y]) => (
        <g key={`${x}-${y}`} shapeRendering="geometricPrecision">
          <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.6} fill="none" stroke="#141821" strokeWidth={1} />
          <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.8} fill="#1d2d52" />
        </g>
      ))}
    </svg>
  );
}

/** Group a base32 secret in fours for reading aloud or typing by hand. */
export function groupSecret(secret: string) {
  return secret.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}

/** Pulls the issuer, account and secret out of an otpauth:// URI. */
export function parseOtpauth(uri: string): { issuer: string | null; account: string | null; secret: string | null } {
  try {
    const u = new URL(uri);
    const label = decodeURIComponent(u.pathname.replace(/^\/+/, "").replace(/^totp\//, ""));
    const [maybeIssuer, account] = label.includes(":") ? label.split(":") : [null, label];
    return { issuer: u.searchParams.get("issuer") ?? maybeIssuer, account: account ?? null, secret: u.searchParams.get("secret") };
  } catch {
    return { issuer: null, account: null, secret: null };
  }
}
