import assert from "node:assert/strict";
import test from "node:test";
import { computeLayout, LayoutType } from "./index.js";

const node = (id, fields = 4) => ({ id, w: 400, h: 57 + fields * 36 });
const edge = (source, target) => ({ source, target });

const fixtures = {
  empty: { nodes: [], edges: [] },
  single: { nodes: [node(0)], edges: [] },
  chain: {
    nodes: [0, 1, 2, 3, 4].map((id) => node(id)),
    edges: [edge(1, 0), edge(2, 1), edge(3, 2), edge(4, 3)],
  },
  star: {
    nodes: [0, 1, 2, 3, 4, 5, 6].map((id) => node(id, id + 2)),
    edges: [1, 2, 3, 4, 5, 6].map((id) => edge(id, 0)),
  },
  cycle: {
    nodes: ["a", "b", "c"].map((id) => node(id)),
    edges: [edge("a", "b"), edge("b", "c"), edge("c", "a"), edge("a", "a")],
  },
  mixed: {
    nodes: [...Array(14).keys()].map((id) => node(id, (id % 5) + 1)),
    edges: [
      edge(1, 0),
      edge(2, 0),
      edge(3, 1),
      edge(3, 2),
      edge(4, 3),
      edge(4, 0),
      edge(6, 5),
      edge(7, 5),
      edge(7, 6),
      edge(8, 99), // unknown table
      edge(10, 9),
      edge(9, 10),
    ],
  },
};

function rects(fixture, positions) {
  return fixture.nodes.map((n) => ({ ...positions.get(n.id), w: n.w, h: n.h }));
}

function assertNoOverlaps(list) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const overlap =
        a.x < b.x + b.w &&
        b.x < a.x + a.w &&
        a.y < b.y + b.h &&
        b.y < a.y + a.h;
      assert.ok(!overlap, `tables ${i} and ${j} overlap`);
    }
  }
}

for (const type of Object.values(LayoutType)) {
  for (const [name, fixture] of Object.entries(fixtures)) {
    test(`${type} layout: ${name}`, () => {
      const positions = computeLayout(type, fixture.nodes, fixture.edges);
      assert.equal(positions.size, fixture.nodes.length);
      for (const n of fixture.nodes) {
        const p = positions.get(n.id);
        assert.ok(p, `missing position for ${n.id}`);
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      }
      assertNoOverlaps(rects(fixture, positions));

      const again = computeLayout(type, fixture.nodes, fixture.edges);
      assert.deepEqual([...again], [...positions]);
    });
  }
}

test("hierarchical layout puts referencing tables right of referenced ones", () => {
  const { nodes, edges } = fixtures.chain;
  const positions = computeLayout(LayoutType.HIERARCHICAL, nodes, edges);
  for (const { source, target } of edges) {
    assert.ok(positions.get(source).x > positions.get(target).x);
  }
});

test("orthogonal layout aligns a chain on one row or column", () => {
  const { nodes, edges } = fixtures.chain;
  const positions = computeLayout(LayoutType.ORTHOGONAL, nodes, edges);
  for (const { source, target } of edges) {
    const a = positions.get(source);
    const b = positions.get(target);
    assert.ok(a.x === b.x || a.y === b.y);
  }
});

test("isolated tables are placed below connected ones", () => {
  const { nodes, edges } = fixtures.mixed;
  const positions = computeLayout(LayoutType.HIERARCHICAL, nodes, edges);
  const connectedBottom = Math.max(
    ...[0, 1, 2, 3, 4, 5, 6, 7, 9, 10].map((id) => positions.get(id).y),
  );
  for (const id of [8, 11, 12, 13]) {
    assert.ok(positions.get(id).y > connectedBottom);
  }
});

test("unknown layout type throws", () => {
  assert.throws(() => computeLayout("nope", [], []));
});
