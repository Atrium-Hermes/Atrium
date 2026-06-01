"use client";

import { useEffect, useRef } from "react";

// Seamless loop built from Atrium's square logo: 6 solid squares on a 3x3 grid
// (diagonal pattern). Each logo square is subdivided into a KxK cloud of small
// squares that drift apart along two orbital harmonics, then reassemble. The
// scatter envelope (1 - cos(ph))/2 is exactly 0 at ph = 0 and 2π, so the loop's
// start AND end frames land on the crisp logo. Honors prefers-reduced-motion.
const LOOP = 9; // seconds — slow + meditative
const K = 5; // subdivisions per logo square → small squares, denser cloud
// (col, row) of the 6 filled cells in the 3x3 logo, top-left origin.
const LOGO: Array<[number, number]> = [
  [0, 0], [2, 0],
  [0, 1], [1, 1],
  [1, 2], [2, 2],
];

type Particle = {
  hx: number; hy: number; side: number;
  r: number; ang0: number; // primary orbit
  r2: number; ang0b: number; // secondary harmonic → non-circular, organic paths
  spin: number;
};

export function HeroLoop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const accent = getColor("--color-accent") || "#3d4b31";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    let particles: Particle[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.clientWidth;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = buildParticles(size);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = (now: number) => {
      const size = canvas.clientWidth;
      const t = ((now - start) / 1000) % LOOP;
      const ph = (2 * Math.PI * t) / LOOP; // 0..2π over the loop
      const env = (1 - Math.cos(ph)) / 2; // 0 at boundary, 1 at mid-loop
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = accent;

      for (const p of particles) {
        const ang = p.ang0 + ph; // one full orbit per loop
        const ang2 = p.ang0b + 2 * ph; // second harmonic (integer → still periodic)
        const ox = env * (p.r * Math.cos(ang) + p.r2 * Math.cos(ang2));
        const oy = env * (p.r * Math.sin(ang) + p.r2 * Math.sin(ang2));
        const s = p.side * (1.18 - 0.62 * env); // assembled → overlap (solid); scattered → tiny distinct squares
        const rot = env * p.spin; // 0 at boundary → squares land axis-aligned
        ctx.globalAlpha = 1 - 0.5 * env;
        ctx.save();
        ctx.translate(p.hx + ox, p.hy + oy);
        if (rot) ctx.rotate(rot);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="h-full w-full" aria-hidden />;
}

// Lay out the 6 logo squares centered in the canvas, subdivide each into KxK
// particles, and seed each with a deterministic orbit (no Math.random — must be
// reproducible so the loop is stable across resizes).
function buildParticles(size: number): Particle[] {
  const pitch = size * 0.17; // distance between logo-cell centers
  const sq = pitch * 0.82; // logo square side (leaves a gap between cells)
  const sub = sq / K; // sub-cell pitch within a square
  const cx = size / 2;
  const cy = size / 2;
  const out: Particle[] = [];
  let gid = 0;

  for (const [col, row] of LOGO) {
    const scx = cx + (col - 1) * pitch;
    const scy = cy + (row - 1) * pitch;
    for (let a = 0; a < K; a++) {
      for (let b = 0; b < K; b++) {
        out.push({
          hx: scx + (a - (K - 1) / 2) * sub,
          hy: scy + (b - (K - 1) / 2) * sub,
          side: sub, // overlap factor applied in draw → assembled cloud reads as one solid square
          r: pitch * (0.5 + 1.7 * hash(gid + 1.7)),
          ang0: hash(gid + 9.3) * Math.PI * 2,
          r2: pitch * (0.2 + 0.8 * hash(gid + 6.4)),
          ang0b: hash(gid + 2.8) * Math.PI * 2,
          spin: (hash(gid + 4.1) - 0.5) * Math.PI * 2.2,
        });
        gid++;
      }
    }
  }
  return out;
}

// Deterministic [0,1) hash (GLSL-style). Math.random is unavailable in this env
// and would also make the loop non-reproducible across resizes.
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function getColor(varName: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}
