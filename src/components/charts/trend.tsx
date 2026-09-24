"use client";

import { useEffect, useRef, useState } from "react";

function useWidth(min = 240) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(min, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, w] as const;
}

function niceCeil(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

/**
 * One series over time: a 2px line over a faint wash, hairline grid, mono
 * axis labels, a crosshair and tooltip on hover (or keyboard focus + arrows),
 * and a hidden table for screen readers.
 */
export function AreaChart({
  data,
  label,
  height = 200,
  color = "var(--series-1)",
  formatY = (v) => String(v),
  formatX = (s) => s,
  tipX,
}: {
  data: { x: string; y: number }[];
  label: string;
  height?: number;
  color?: string;
  formatY?: (v: number) => string;
  formatX?: (s: string) => string;
  tipX?: (s: string) => string;
}) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 52;
  const padR = 12;
  const padT = 10;
  const padB = 24;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const max = niceCeil(Math.max(1, ...data.map((d) => d.y)) * 1.08);
  const x = (i: number) => padL + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const pts = data.map((d, i) => [x(i), y(d.y)] as const);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const area = pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)} ${padT + innerH} L${pts[0][0].toFixed(1)} ${padT + innerH} Z` : "";
  const ticks = [0, max / 2, max];
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 76))));
  const gradId = `g-${label.replace(/\W+/g, "")}`;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    if (!data.length) return;
    const i = Math.round(((px - padL) / Math.max(1, innerW)) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };

  return (
    <div className="relative" ref={ref}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width={w}
        height={height}
        className="block w-full touch-pan-y outline-none"
        role="img"
        aria-label={label}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((h) => Math.min(data.length - 1, (h ?? -1) + 1));
          if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? data.length) - 1));
        }}
        onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: color, stopOpacity: 0.16 }} />
            <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} style={{ stroke: "var(--line)" }} strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-faint)" }}>
              {formatY(t)}
            </text>
          </g>
        ))}
        {area && <path d={area} fill={`url(#${gradId})`} />}
        {line && <path d={line} fill="none" style={{ stroke: color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {data.map((d, i) =>
          i % every === 0 || i === data.length - 1 ? (
            (i === data.length - 1 || data.length - 1 - i >= every * 0.6) && (
              <text key={d.x} x={x(i)} y={height - 7} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-muted)" }}>
                {formatX(d.x)}
              </text>
            )
          ) : null,
        )}
        {pts.length > 0 && hover === null && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={4} style={{ fill: color, stroke: "var(--surface)" }} strokeWidth={2} />}
        {hover !== null && pts[hover] && (
          <g>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1={padT} y2={padT + innerH} style={{ stroke: "var(--ink-faint)" }} strokeDasharray="3 3" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r={5} style={{ fill: color, stroke: "var(--surface)" }} strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-sm border border-line bg-surface px-2.5 py-1.5 text-[12px] whitespace-nowrap shadow-float"
          style={{ left: `${(pts[hover][0] / w) * 100}%`, transform: `translateX(${pts[hover][0] > w * 0.7 ? "-100%" : pts[hover][0] < w * 0.25 ? "0" : "-50%"})` }}
        >
          <span className="font-mono text-ink">{formatY(data[hover].y)}</span>
          <span className="ml-2 text-ink-muted">{tipX ? tipX(data[hover].x) : formatX(data[hover].x)}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.x}>
              <th>{d.x}</th>
              <td>{formatY(d.y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A 2px trend line without axes, for tiles. */
export function Sparkline({ values, color = "var(--series-1)", width = 96, height = 28, label }: { values: number[]; color?: string; width?: number; height?: number; label: string }) {
  if (values.length < 2) return <span className="inline-block" style={{ width, height }} aria-hidden />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="block overflow-visible">
      <path d={d} fill="none" style={{ stroke: color }} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} style={{ fill: color }} />
    </svg>
  );
}

/** A horizontal bar with a value, for ranked lists (queues, DB sizes, usage). */
export function RankBar({ value, max, color = "var(--series-1)", hatch }: { value: number; max: number; color?: string; hatch?: boolean }) {
  const pct = max > 0 ? Math.max(value > 0 ? 1.5 : 0, (value / max) * 100) : 0;
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-xs bg-surface-2" aria-hidden>
      <div className={hatch ? "hatch absolute inset-y-0 left-0 rounded-xs" : "absolute inset-y-0 left-0 rounded-xs"} style={{ width: `${pct}%`, background: hatch ? undefined : color, color, border: hatch ? `1px solid ${color}` : undefined }} />
    </div>
  );
}
