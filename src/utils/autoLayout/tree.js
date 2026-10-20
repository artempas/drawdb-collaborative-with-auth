/**
 * Tidy tree layout, growing from left to right. The root is a table that
 * references nothing (preferring the most connected one); a breadth first
 * spanning tree over the relationships defines parents and children, and
 * relationships outside the tree are left as they are.
 *
 * @returns {{ x: number, y: number, w: number, h: number }[]} rects in node order
 */
export function treeLayout(graph, { gapX, gapY }) {
  const { n, nodes, adj, out } = graph;
  const degree = (v) => adj[v].length;

  let root = 0;
  for (let v = 1; v < n; v++) {
    const better =
      (out[v].length === 0) !== (out[root].length === 0)
        ? out[v].length === 0
        : degree(v) > degree(root);
    if (better) root = v;
  }

  const children = Array.from({ length: n }, () => []);
  const depth = new Array(n).fill(-1);
  depth[root] = 0;
  const queue = [root];
  while (queue.length > 0) {
    const v = queue.shift();
    // Busier branches first keeps the drawing balanced.
    const next = adj[v]
      .filter((u) => depth[u] === -1)
      .sort((a, b) => degree(b) - degree(a) || a - b);
    for (const u of next) {
      depth[u] = depth[v] + 1;
      children[v].push(u);
      queue.push(u);
    }
  }

  const levels = Math.max(...depth) + 1;
  const levelWidth = new Array(levels).fill(0);
  for (let v = 0; v < n; v++) {
    levelWidth[depth[v]] = Math.max(levelWidth[depth[v]], nodes[v].w);
  }
  const levelX = [];
  let x = 0;
  for (const width of levelWidth) {
    levelX.push(x);
    x += width + gapX;
  }

  // Height of the band each subtree occupies, computed bottom-up.
  const order = [];
  const stack = [root];
  while (stack.length > 0) {
    const v = stack.pop();
    order.push(v);
    stack.push(...children[v]);
  }
  const extent = new Array(n).fill(0);
  for (let i = order.length - 1; i >= 0; i--) {
    const v = order[i];
    const kids = children[v];
    const kidsExtent =
      kids.reduce((sum, u) => sum + extent[u], 0) +
      Math.max(0, kids.length - 1) * gapY;
    extent[v] = Math.max(nodes[v].h, kidsExtent);
  }

  // Each subtree is placed inside its band; siblings get disjoint bands, so
  // nothing can overlap. Parents are centred on their children.
  const y = new Array(n).fill(0);
  const place = (v, top) => {
    const kids = children[v];
    if (kids.length === 0) {
      y[v] = top + (extent[v] - nodes[v].h) / 2;
      return;
    }
    const kidsExtent =
      kids.reduce((sum, u) => sum + extent[u], 0) + (kids.length - 1) * gapY;
    let childTop = top + (extent[v] - kidsExtent) / 2;
    for (const u of kids) {
      place(u, childTop);
      childTop += extent[u] + gapY;
    }
    const first = kids[0];
    const last = kids[kids.length - 1];
    const center =
      (y[first] + nodes[first].h / 2 + y[last] + nodes[last].h / 2) / 2;
    y[v] = Math.min(
      Math.max(center - nodes[v].h / 2, top),
      top + extent[v] - nodes[v].h,
    );
  };
  place(root, 0);

  return nodes.map((node, v) => ({
    x: levelX[depth[v]],
    y: y[v],
    w: node.w,
    h: node.h,
  }));
}
