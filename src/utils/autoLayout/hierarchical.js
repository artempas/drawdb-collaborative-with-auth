const DUMMY_SIZE = 24;
const ORDERING_SWEEPS = 8;
const ALIGN_SWEEPS = 4;

/**
 * Sugiyama style layered layout. Referenced tables end up in the leftmost
 * layers and the tables holding foreign keys to them to the right, so most
 * relationships point in the same direction.
 *
 * @returns {{ x: number, y: number, w: number, h: number }[]} rects in node order
 */
export function hierarchicalLayout(graph, { gapX, gapY }) {
  const edges = acyclicEdges(graph);
  const layerOf = assignLayers(graph.n, edges);
  const { layers, vertices, links } = buildLayeredGraph(graph, edges, layerOf);

  orderLayers(layers, links);

  const layerX = [];
  let x = 0;
  for (const layer of layers) {
    layerX.push(x);
    const width = Math.max(0, ...layer.map((v) => vertices[v].w));
    x += width + gapX;
  }

  const y = assignY(layers, vertices, links, gapY);

  return graph.nodes.map((node, i) => ({
    x: layerX[layerOf[i]],
    y: y[i],
    w: node.w,
    h: node.h,
  }));
}

/**
 * Returns the edge list with cycles broken by reversing DFS back edges.
 */
function acyclicEdges(graph) {
  const state = new Array(graph.n).fill(0); // 0 new, 1 on stack, 2 done
  const result = new Set();
  const add = (s, t) => result.add(`${s}:${t}`);

  for (let root = 0; root < graph.n; root++) {
    if (state[root] !== 0) continue;
    const stack = [[root, 0]];
    state[root] = 1;
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const [v, next] = top;
      if (next >= graph.out[v].length) {
        state[v] = 2;
        stack.pop();
        continue;
      }
      top[1]++;
      const u = graph.out[v][next];
      if (state[u] === 1) {
        add(u, v);
      } else {
        add(v, u);
        if (state[u] === 0) {
          state[u] = 1;
          stack.push([u, 0]);
        }
      }
    }
  }

  const edges = [];
  for (const key of result) {
    const [s, t] = key.split(":").map(Number);
    if (!result.has(`${t}:${s}`) || s < t) edges.push([s, t]);
  }
  return edges;
}

/**
 * Longest path layering: a table is placed one layer to the right of the
 * rightmost table it references. Tables that only are referenced are then
 * pulled next to their closest referencing table to shorten edges.
 */
function assignLayers(n, edges) {
  const out = Array.from({ length: n }, () => []);
  const inc = Array.from({ length: n }, () => []);
  for (const [s, t] of edges) {
    out[s].push(t);
    inc[t].push(s);
  }

  const layer = new Array(n).fill(-1);
  for (let root = 0; root < n; root++) {
    if (layer[root] !== -1) continue;
    const stack = [root];
    while (stack.length > 0) {
      const v = stack[stack.length - 1];
      const pending = out[v].filter((u) => layer[u] === -1);
      if (pending.length > 0) {
        stack.push(...pending);
        continue;
      }
      stack.pop();
      if (layer[v] !== -1) continue;
      layer[v] =
        out[v].length === 0 ? 0 : 1 + Math.max(...out[v].map((u) => layer[u]));
    }
  }

  for (let v = 0; v < n; v++) {
    if (out[v].length === 0 && inc[v].length > 0) {
      layer[v] = Math.min(...inc[v].map((u) => layer[u])) - 1;
    }
  }

  // Drop layers left empty by the step above.
  const used = [...new Set(layer)].sort((a, b) => a - b);
  const compact = new Map(used.map((l, i) => [l, i]));
  return layer.map((l) => compact.get(l));
}

/**
 * Splits long edges with dummy vertices so that every link connects
 * neighbouring layers.
 */
function buildLayeredGraph(graph, edges, layerOf) {
  const vertices = graph.nodes.map((node, i) => ({
    w: node.w,
    h: node.h,
    layer: layerOf[i],
  }));
  const links = [];

  for (const [s, t] of edges) {
    let prev = t;
    for (let l = layerOf[t] + 1; l < layerOf[s]; l++) {
      vertices.push({ w: 0, h: DUMMY_SIZE, layer: l, dummy: true });
      const dummy = vertices.length - 1;
      links.push([prev, dummy]);
      prev = dummy;
    }
    links.push([prev, s]);
  }

  const layerCount = Math.max(0, ...vertices.map((v) => v.layer)) + 1;
  const layers = Array.from({ length: layerCount }, () => []);

  // Initial order: depth first from the leftmost layer keeps related
  // vertices close together before the barycenter sweeps.
  const neighbours = vertices.map(() => []);
  for (const [a, b] of links) {
    neighbours[a].push(b);
    neighbours[b].push(a);
  }
  const seen = new Array(vertices.length).fill(false);
  const roots = vertices
    .map((v, i) => i)
    .sort((a, b) => vertices[a].layer - vertices[b].layer || a - b);
  for (const root of roots) {
    if (seen[root]) continue;
    const stack = [root];
    while (stack.length > 0) {
      const v = stack.pop();
      if (seen[v]) continue;
      seen[v] = true;
      layers[vertices[v].layer].push(v);
      for (let i = neighbours[v].length - 1; i >= 0; i--) {
        if (!seen[neighbours[v][i]]) stack.push(neighbours[v][i]);
      }
    }
  }

  return { layers, vertices, links: neighbourLists(vertices, links) };
}

function neighbourLists(vertices, links) {
  const left = vertices.map(() => []);
  const right = vertices.map(() => []);
  for (const [a, b] of links) {
    // `a` is always in the layer directly left of `b`.
    right[a].push(b);
    left[b].push(a);
  }
  return { left, right };
}

function orderLayers(layers, links) {
  let best = layers.map((layer) => layer.slice());
  let bestCrossings = countCrossings(layers, links);

  for (let sweep = 0; sweep < ORDERING_SWEEPS && bestCrossings > 0; sweep++) {
    const forward = sweep % 2 === 0;
    const range = forward
      ? layers.map((_, i) => i).slice(1)
      : layers
          .map((_, i) => i)
          .slice(0, -1)
          .reverse();

    for (const l of range) {
      const fixed = layers[forward ? l - 1 : l + 1];
      const position = new Map(fixed.map((v, i) => [v, i]));
      const neighbours = forward ? links.left : links.right;
      const current = new Map(layers[l].map((v, i) => [v, i]));
      const barycenter = new Map(
        layers[l].map((v) => {
          const ns = neighbours[v];
          if (ns.length === 0) return [v, current.get(v)];
          const sum = ns.reduce((acc, u) => acc + position.get(u), 0);
          return [
            v,
            (sum / ns.length) * (layers[l].length / Math.max(1, fixed.length)),
          ];
        }),
      );
      layers[l].sort(
        (a, b) =>
          barycenter.get(a) - barycenter.get(b) ||
          current.get(a) - current.get(b),
      );
    }

    const crossings = countCrossings(layers, links);
    if (crossings < bestCrossings) {
      bestCrossings = crossings;
      best = layers.map((layer) => layer.slice());
    }
  }

  best.forEach((layer, i) => {
    layers[i] = layer;
  });
}

function countCrossings(layers, links) {
  let total = 0;
  for (let l = 0; l + 1 < layers.length; l++) {
    const rightPos = new Map(layers[l + 1].map((v, i) => [v, i]));
    const segments = [];
    layers[l].forEach((v, i) => {
      for (const u of links.right[v]) segments.push([i, rightPos.get(u)]);
    });
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const [a1, b1] = segments[i];
        const [a2, b2] = segments[j];
        if ((a1 - a2) * (b1 - b2) < 0) total++;
      }
    }
  }
  return total;
}

/**
 * Vertical placement: every vertex is pulled towards the average centre of
 * its neighbours in the adjacent layer while keeping the layer order and
 * the minimum gap. Averaging a top-down and a bottom-up packing keeps the
 * result free of overlaps (both satisfy the same linear constraints).
 */
function assignY(layers, vertices, links, gapY) {
  const y = new Array(vertices.length).fill(0);
  const gapFor = (v) => (vertices[v].dummy ? gapY / 2 : gapY);

  for (const layer of layers) {
    let top = 0;
    for (const v of layer) {
      y[v] = top;
      top += vertices[v].h + gapFor(v);
    }
  }

  const center = (v) => y[v] + vertices[v].h / 2;

  const align = (layer, neighbours) => {
    const desired = layer.map((v) => {
      const ns = neighbours[v];
      if (ns.length === 0) return y[v];
      const avg = ns.reduce((acc, u) => acc + center(u), 0) / ns.length;
      return avg - vertices[v].h / 2;
    });

    const down = desired.slice();
    for (let i = 1; i < layer.length; i++) {
      const prev = layer[i - 1];
      down[i] = Math.max(
        down[i],
        down[i - 1] + vertices[prev].h + gapFor(prev),
      );
    }
    const up = desired.slice();
    for (let i = layer.length - 2; i >= 0; i--) {
      const v = layer[i];
      up[i] = Math.min(up[i], up[i + 1] - vertices[v].h - gapFor(v));
    }
    layer.forEach((v, i) => {
      y[v] = (down[i] + up[i]) / 2;
    });
  };

  for (let sweep = 0; sweep < ALIGN_SWEEPS; sweep++) {
    for (let l = 1; l < layers.length; l++) align(layers[l], links.left);
    for (let l = layers.length - 2; l >= 0; l--) align(layers[l], links.right);
  }

  return y;
}
