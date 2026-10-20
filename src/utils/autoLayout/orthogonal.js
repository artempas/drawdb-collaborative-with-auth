/**
 * Grid based layout: every table gets its own grid cell, chosen greedily so
 * that related tables share a row or a column next to each other. Rows and
 * columns are then shrunk to the tables they contain. Aligned tables give
 * straight horizontal or vertical relationship lines with few bends.
 *
 * @returns {{ x: number, y: number, w: number, h: number }[]} rects in node order
 */
export function orthogonalLayout(graph, { gapX, gapY }) {
  const { n, nodes, adj } = graph;
  const degree = (v) => adj[v].length;

  // Placement order: most connected table first, then breadth first so each
  // table already has a placed neighbour when its turn comes.
  const order = [];
  const seen = new Array(n).fill(false);
  const starts = [...Array(n).keys()].sort(
    (a, b) => degree(b) - degree(a) || a - b,
  );
  for (const start of starts) {
    if (seen[start]) continue;
    seen[start] = true;
    const queue = [start];
    while (queue.length > 0) {
      const v = queue.shift();
      order.push(v);
      const next = adj[v]
        .filter((u) => !seen[u])
        .sort((a, b) => degree(b) - degree(a) || a - b);
      for (const u of next) {
        seen[u] = true;
        queue.push(u);
      }
    }
  }

  const cellOf = new Array(n).fill(null);
  const occupied = new Map();
  const key = (r, c) => `${r}:${c}`;
  let minR = 0;
  let maxR = 0;
  let minC = 0;
  let maxC = 0;

  // Cells are roughly as wide as a table and less tall, so a column step
  // costs a bit more than a row step in canvas distance.
  const aspect = 1.3;

  for (const v of order) {
    if (occupied.size === 0) {
      cellOf[v] = [0, 0];
      occupied.set(key(0, 0), v);
      continue;
    }

    const placedNeighbours = adj[v].filter((u) => cellOf[u] !== null);
    let best = null;
    let bestCost = Infinity;
    for (let r = minR - 1; r <= maxR + 1; r++) {
      for (let c = minC - 1; c <= maxC + 1; c++) {
        if (occupied.has(key(r, c))) continue;
        let cost = 0;
        for (const u of placedNeighbours) {
          const [ur, uc] = cellOf[u];
          const dr = Math.abs(ur - r);
          const dc = Math.abs(uc - c);
          cost += 10 * (dr + dc * aspect);
          // Prefer sharing a row or column (straight connections).
          if (dr !== 0 && dc !== 0) cost += 6;
        }
        // Keep the drawing compact and roughly square.
        const height = Math.max(maxR, r) - Math.min(minR, r) + 1;
        const width = Math.max(maxC, c) - Math.min(minC, c) + 1;
        cost +=
          2 * Math.max(height, width * aspect) +
          0.1 * (Math.abs(r) + Math.abs(c));
        if (cost < bestCost) {
          bestCost = cost;
          best = [r, c];
        }
      }
    }

    cellOf[v] = best;
    occupied.set(key(best[0], best[1]), v);
    minR = Math.min(minR, best[0]);
    maxR = Math.max(maxR, best[0]);
    minC = Math.min(minC, best[1]);
    maxC = Math.max(maxC, best[1]);
  }

  // Compact: only rows and columns that hold a table take space.
  const rowHeight = new Map();
  const colWidth = new Map();
  for (let v = 0; v < n; v++) {
    const [r, c] = cellOf[v];
    rowHeight.set(r, Math.max(rowHeight.get(r) ?? 0, nodes[v].h));
    colWidth.set(c, Math.max(colWidth.get(c) ?? 0, nodes[v].w));
  }
  const offsets = (sizes, gap) => {
    const result = new Map();
    let pos = 0;
    for (const index of [...sizes.keys()].sort((a, b) => a - b)) {
      result.set(index, pos);
      pos += sizes.get(index) + gap;
    }
    return result;
  };
  const rowY = offsets(rowHeight, gapY);
  const colX = offsets(colWidth, gapX);

  return nodes.map((node, v) => ({
    x: colX.get(cellOf[v][1]),
    y: rowY.get(cellOf[v][0]),
    w: node.w,
    h: node.h,
  }));
}
