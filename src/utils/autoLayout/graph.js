/**
 * Builds an index-based graph from layout nodes and directed edges.
 * Edges point from the referencing table (FK owner) to the referenced one.
 * Self loops, duplicates and edges to unknown nodes are dropped.
 *
 * @param {{ id: any, w: number, h: number }[]} nodes
 * @param {{ source: any, target: any }[]} edges
 */
export function buildGraph(nodes, edges) {
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const out = nodes.map(() => new Set());
  const inc = nodes.map(() => new Set());
  const adj = nodes.map(() => new Set());

  for (const edge of edges) {
    const s = index.get(edge.source);
    const t = index.get(edge.target);
    if (s === undefined || t === undefined || s === t) continue;
    out[s].add(t);
    inc[t].add(s);
    adj[s].add(t);
    adj[t].add(s);
  }

  const sorted = (sets) => sets.map((set) => [...set].sort((a, b) => a - b));

  return {
    nodes,
    n: nodes.length,
    out: sorted(out),
    in: sorted(inc),
    adj: sorted(adj),
  };
}

/**
 * Splits the graph into connected components (ignoring edge direction).
 * Components and their members are returned in a deterministic order.
 */
export function components(graph) {
  const seen = new Array(graph.n).fill(false);
  const result = [];
  for (let start = 0; start < graph.n; start++) {
    if (seen[start]) continue;
    const comp = [];
    const queue = [start];
    seen[start] = true;
    while (queue.length > 0) {
      const v = queue.shift();
      comp.push(v);
      for (const u of graph.adj[v]) {
        if (!seen[u]) {
          seen[u] = true;
          queue.push(u);
        }
      }
    }
    result.push(comp.sort((a, b) => a - b));
  }
  return result;
}

/**
 * Extracts the induced subgraph over the given node indices.
 */
export function subgraph(graph, indices) {
  const local = new Map(indices.map((v, i) => [v, i]));
  const nodes = indices.map((v) => graph.nodes[v]);
  const edges = [];
  for (const v of indices) {
    for (const u of graph.out[v]) {
      if (local.has(u)) {
        edges.push({ source: graph.nodes[v].id, target: graph.nodes[u].id });
      }
    }
  }
  return buildGraph(nodes, edges);
}

export function rectsOverlap(a, b, gap = 0) {
  return (
    a.x < b.x + b.w + gap &&
    b.x < a.x + a.w + gap &&
    a.y < b.y + b.h + gap &&
    b.y < a.y + a.h + gap
  );
}

/**
 * Pushes overlapping rectangles apart along the axis of least penetration.
 * Mutates `rects` ({ x, y, w, h }, top-left based).
 */
export function removeOverlaps(rects, gap = 0, maxPasses = 200) {
  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        if (!rectsOverlap(a, b, gap)) continue;

        const acx = a.x + a.w / 2;
        const acy = a.y + a.h / 2;
        const bcx = b.x + b.w / 2;
        const bcy = b.y + b.h / 2;
        const overlapX = (a.w + b.w) / 2 + gap - Math.abs(acx - bcx);
        const overlapY = (a.h + b.h) / 2 + gap - Math.abs(acy - bcy);

        if (overlapX <= overlapY) {
          const dir = acx < bcx || (acx === bcx && i < j) ? -1 : 1;
          const shift = overlapX / 2 + 0.5;
          a.x += dir * shift;
          b.x -= dir * shift;
        } else {
          const dir = acy < bcy || (acy === bcy && i < j) ? -1 : 1;
          const shift = overlapY / 2 + 0.5;
          a.y += dir * shift;
          b.y -= dir * shift;
        }
        moved = true;
      }
    }
    if (!moved) return;
  }
}
