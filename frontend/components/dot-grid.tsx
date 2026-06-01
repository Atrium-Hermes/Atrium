/**
 * The matrix-os signature: a square halftone grid of dots with varying radii.
 * Radii are deterministic (no RNG) so server/client render identically.
 */
export function DotGrid({ cols = 11, rows = 11, gap = 30 }: { cols?: number; rows?: number; gap?: number }) {
  const pad = gap;
  const w = pad * 2 + (cols - 1) * gap;
  const h = pad * 2 + (rows - 1) * gap;
  const dots: Array<{ x: number; y: number; r: number }> = [];

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      // smooth deterministic variation in [0,1]
      const n = 0.5 + 0.5 * Math.sin(i * 12.9898 + j * 78.233);
      const r = 1.6 + n * 4.2;
      dots.push({ x: pad + i * gap, y: pad + j * gap, r });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-full w-full"
      role="img"
      aria-label="Decorative dot grid"
    >
      {dots.map((d, k) => (
        <circle key={k} cx={d.x} cy={d.y} r={d.r} fill="var(--color-foreground)" opacity={0.82} />
      ))}
    </svg>
  );
}
