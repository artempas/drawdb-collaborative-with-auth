/**
 * Arranges independently laid out blocks (connected components) on shelves
 * and puts isolated nodes into a grid after them.
 *
 * @param {{ x: number, y: number, w: number, h: number }[][]} blocks
 *   rectangles of each component, in any local coordinate system
 * @param {{ x: number, y: number, w: number, h: number }[]} isolated
 * @returns the same rectangles, moved in place
 */
export function packBlocks(blocks, isolated, { gap, origin }) {
  const boxes = blocks.map((rects) => normalize(rects));
  if (isolated.length > 0) boxes.push(gridBlock(isolated, gap));

  const order = boxes
    .map((box, i) => ({ box, i }))
    .sort((a, b) => {
      // Isolated tables always go last.
      if (a.box.isolated !== b.box.isolated) return a.box.isolated ? 1 : -1;
      return b.box.w * b.box.h - a.box.w * a.box.h || a.i - b.i;
    })
    .map(({ box }) => box);

  const totalArea = order.reduce(
    (sum, box) => sum + (box.w + gap) * (box.h + gap),
    0,
  );
  const widest = order.reduce((max, box) => Math.max(max, box.w), 0);
  const shelfWidth = Math.max(widest, Math.sqrt(totalArea) * 1.5);

  let x = 0;
  let y = 0;
  let shelfHeight = 0;
  for (const box of order) {
    if (x > 0 && (x + box.w > shelfWidth || box.isolated)) {
      x = 0;
      y += shelfHeight + gap;
      shelfHeight = 0;
    }
    for (const rect of box.rects) {
      rect.x += origin.x + x;
      rect.y += origin.y + y;
    }
    x += box.w + gap;
    shelfHeight = Math.max(shelfHeight, box.h);
  }
}

function normalize(rects) {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  let w = 0;
  let h = 0;
  for (const rect of rects) {
    rect.x -= minX;
    rect.y -= minY;
    w = Math.max(w, rect.x + rect.w);
    h = Math.max(h, rect.y + rect.h);
  }
  return { rects, w, h, isolated: false };
}

function gridBlock(rects, gap) {
  const cols = Math.ceil(Math.sqrt(rects.length));
  const colWidths = new Array(cols).fill(0);
  const rowHeights = [];
  rects.forEach((rect, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    colWidths[col] = Math.max(colWidths[col], rect.w);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, rect.h);
  });

  const colX = [];
  let x = 0;
  for (const width of colWidths) {
    colX.push(x);
    x += width + gap;
  }
  const rowY = [];
  let y = 0;
  for (const height of rowHeights) {
    rowY.push(y);
    y += height + gap;
  }

  rects.forEach((rect, i) => {
    rect.x = colX[i % cols];
    rect.y = rowY[Math.floor(i / cols)];
  });

  return { rects, w: x - gap, h: y - gap, isolated: true };
}
