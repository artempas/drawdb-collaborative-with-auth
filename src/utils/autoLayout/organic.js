import { removeOverlaps } from "./graph.js";

const ITERATIONS = 300;
// Pull towards the centre that keeps loosely connected parts close.
const GRAVITY = 0.02;

/**
 * Force directed layout (Fruchterman–Reingold) adapted to rectangles:
 * distances are measured between table borders rather than centres.
 * The start positions are deterministic so every collaborator computing the
 * layout gets the same result.
 *
 * @returns {{ x: number, y: number, w: number, h: number }[]} rects in node order
 */
export function organicLayout(graph, { gapX, gapY }) {
  const { n, nodes, adj } = graph;
  const ideal = gapX + gapY;
  const radius = nodes.map((node) => Math.max(node.w, node.h) / 2);

  const avgSize =
    nodes.reduce((sum, node) => sum + Math.max(node.w, node.h), 0) / n;
  const circle = Math.max(avgSize, (n * (avgSize + ideal)) / (2 * Math.PI));
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  for (let v = 0; v < n; v++) {
    const angle = (2 * Math.PI * v) / n;
    px[v] = Math.cos(angle) * circle;
    py[v] = Math.sin(angle) * circle;
  }

  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  const k2 = ideal * ideal;
  let temperature = circle / 2;
  const cooling = temperature / ITERATIONS;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    dx.fill(0);
    dy.fill(0);

    for (let v = 0; v < n; v++) {
      for (let u = v + 1; u < n; u++) {
        let ddx = px[v] - px[u];
        let ddy = py[v] - py[u];
        let dist = Math.hypot(ddx, ddy);
        if (dist < 1e-6) {
          // Coincident nodes: separate along a deterministic direction.
          const angle = ((v * 31 + u * 17) % 360) * (Math.PI / 180);
          ddx = Math.cos(angle);
          ddy = Math.sin(angle);
          dist = 1;
        }
        const gap = Math.max(dist - radius[v] - radius[u], 1);
        const force = k2 / gap;
        const fx = (ddx / dist) * force;
        const fy = (ddy / dist) * force;
        dx[v] += fx;
        dy[v] += fy;
        dx[u] -= fx;
        dy[u] -= fy;
      }
    }

    for (let v = 0; v < n; v++) {
      for (const u of adj[v]) {
        if (u < v) continue;
        const ddx = px[v] - px[u];
        const ddy = py[v] - py[u];
        const dist = Math.max(Math.hypot(ddx, ddy), 1e-6);
        const gap = Math.max(dist - radius[v] - radius[u], 1);
        const force = (gap * gap) / ideal;
        const fx = (ddx / dist) * force;
        const fy = (ddy / dist) * force;
        dx[v] -= fx;
        dy[v] -= fy;
        dx[u] += fx;
        dy[u] += fy;
      }
    }

    let cx = 0;
    let cy = 0;
    for (let v = 0; v < n; v++) {
      cx += px[v] / n;
      cy += py[v] / n;
    }
    for (let v = 0; v < n; v++) {
      dx[v] -= (px[v] - cx) * GRAVITY * adj[v].length;
      dy[v] -= (py[v] - cy) * GRAVITY * adj[v].length;
    }

    for (let v = 0; v < n; v++) {
      const len = Math.hypot(dx[v], dy[v]);
      if (len < 1e-9) continue;
      const step = Math.min(len, temperature);
      px[v] += (dx[v] / len) * step;
      py[v] += (dy[v] / len) * step;
    }

    temperature = Math.max(temperature - cooling, 1);
  }

  const rects = nodes.map((node, v) => ({
    x: px[v] - node.w / 2,
    y: py[v] - node.h / 2,
    w: node.w,
    h: node.h,
  }));
  removeOverlaps(rects, Math.min(gapX, gapY));
  return rects;
}
