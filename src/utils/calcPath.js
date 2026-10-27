import { tableFieldHeight, tableHeaderHeight } from "../data/constants";
import { getCommentHeight, getFieldOffsetY } from "./utils";

/**
 * Generates an SVG path string to visually represent a relationship between two fields.
 *
 * @param {{
 *   startTable: { x: number, y: number },
 *   endTable: { x: number, y: number },
 *   startFieldIndex: number,
 *   endFieldIndex: number,
 *   midOffset?: number
 * }} r - Relationship data. `midOffset` shifts the vertical segment of the
 *   arc horizontally from its default position.
 * @param {number} tableWidth - Width of each table (used to calculate horizontal offsets).
 * @param {number} zoom - Zoom level (used to scale vertical spacing).
 * @returns {string} SVG path "d" attribute string.
 */
export function calcPath(r, tableWidth = 200, zoom = 1, showComments = true) {
  if (!r) {
    return "";
  }

  const width = tableWidth * zoom;
  let x1 = r.startTable.x;
  let y1 =
    r.startTable.y +
    getFieldOffsetY(
      r.startTable.fields ?? [],
      r.startFieldIndex,
      tableWidth,
      showComments,
    ) +
    tableHeaderHeight +
    getCommentHeight(r.startTable.comment, tableWidth, showComments) +
    tableFieldHeight / 2;
  let x2 = r.endTable.x;
  let y2 =
    r.endTable.y +
    getFieldOffsetY(
      r.endTable.fields ?? [],
      r.endFieldIndex,
      tableWidth,
      showComments,
    ) +
    getCommentHeight(r.endTable.comment, tableWidth, showComments) +
    tableHeaderHeight +
    tableFieldHeight / 2;

  let radius = 10 * zoom;
  const midX = (x2 + x1 + width) / 2;
  const endX = x2 + width < x1 ? x2 + width : x2;
  const midOffset = r.midOffset ?? 0;

  if (Math.abs(y1 - y2) <= 36 * zoom) {
    radius = Math.abs(y2 - y1) / 3;
  }

  // A moved arc: shift the vertical segment and reroute around it.
  if (midOffset) {
    const trunkX =
      defaultTrunkX(x1, y1, x2, y2, width, midX, radius) + midOffset;
    return orthogonalPath(x1, y1, x2, y2, width, trunkX, 10 * zoom);
  }

  if (Math.abs(y1 - y2) <= 36 * zoom) {
    if (radius <= 2) {
      if (x1 + width <= x2) return `M ${x1 + width} ${y1} L ${x2} ${y2 + 0.1}`;
      else if (x2 + width < x1)
        return `M ${x1} ${y1} L ${x2 + width} ${y2 + 0.1}`;
    }
  }

  if (y1 <= y2) {
    if (x1 + width <= x2) {
      return `M ${x1 + width} ${y1} L ${
        midX - radius
      } ${y1} A ${radius} ${radius} 0 0 1 ${midX} ${y1 + radius} L ${midX} ${
        y2 - radius
      } A ${radius} ${radius} 0 0 0 ${midX + radius} ${y2} L ${endX} ${y2}`;
    } else if (x2 <= x1 + width && x1 <= x2) {
      return `M ${x1 + width} ${y1} L ${
        x2 + width
      } ${y1} A ${radius} ${radius} 0 0 1 ${x2 + width + radius} ${
        y1 + radius
      } L ${x2 + width + radius} ${y2 - radius} A ${radius} ${radius} 0 0 1 ${
        x2 + width
      } ${y2} L ${x2 + width} ${y2}`;
    } else if (x2 + width >= x1 && x2 + width <= x1 + width) {
      return `M ${x1} ${y1} L ${
        x2 - radius
      } ${y1} A ${radius} ${radius} 0 0 0 ${x2 - radius - radius} ${
        y1 + radius
      } L ${x2 - radius - radius} ${y2 - radius} A ${radius} ${radius} 0 0 0 ${
        x2 - radius
      } ${y2} L ${x2} ${y2}`;
    } else {
      return `M ${x1} ${y1} L ${
        midX + radius
      } ${y1} A ${radius} ${radius} 0 0 0 ${midX} ${y1 + radius} L ${midX} ${
        y2 - radius
      } A ${radius} ${radius} 0 0 1 ${midX - radius} ${y2} L ${endX} ${y2}`;
    }
  } else {
    if (x1 + width <= x2) {
      return `M ${x1 + width} ${y1} L ${
        midX - radius
      } ${y1} A ${radius} ${radius} 0 0 0 ${midX} ${y1 - radius} L ${midX} ${
        y2 + radius
      } A ${radius} ${radius} 0 0 1 ${midX + radius} ${y2} L ${endX} ${y2}`;
    } else if (x1 + width >= x2 && x1 + width <= x2 + width) {
      return `M ${x1} ${y1} L ${
        x1 - radius - radius
      } ${y1} A ${radius} ${radius} 0 0 1 ${x1 - radius - radius - radius} ${
        y1 - radius
      } L ${x1 - radius - radius - radius} ${
        y2 + radius
      } A ${radius} ${radius} 0 0 1 ${
        x1 - radius - radius
      } ${y2} L ${endX} ${y2}`;
    } else if (x1 >= x2 && x1 <= x2 + width) {
      return `M ${x1 + width} ${y1} L ${
        x1 + width + radius
      } ${y1} A ${radius} ${radius} 0 0 0 ${x1 + width + radius + radius} ${
        y1 - radius
      } L ${x1 + width + radius + radius} ${
        y2 + radius
      } A ${radius} ${radius} 0 0 0 ${x1 + width + radius} ${y2} L ${
        x2 + width
      } ${y2}`;
    } else {
      return `M ${x1} ${y1} L ${
        midX + radius
      } ${y1} A ${radius} ${radius} 0 0 1 ${midX} ${y1 - radius} L ${midX} ${
        y2 + radius
      } A ${radius} ${radius} 0 0 0 ${midX - radius} ${y2} L ${endX} ${y2}`;
    }
  }
}

/**
 * The x of the vertical segment drawn by `calcPath` for an arc that was not
 * moved, mirroring its branches.
 */
function defaultTrunkX(x1, y1, x2, y2, width, midX, radius) {
  if (y1 <= y2) {
    if (x1 + width <= x2) return midX;
    if (x2 <= x1 + width && x1 <= x2) return x2 + width + radius;
    if (x2 + width >= x1 && x2 + width <= x1 + width) return x2 - 2 * radius;
    return midX;
  }
  if (x1 + width <= x2) return midX;
  if (x1 + width >= x2 && x1 + width <= x2 + width) return x1 - 3 * radius;
  if (x1 >= x2 && x1 <= x2 + width) return x1 + width + 2 * radius;
  return midX;
}

/**
 * A rounded orthogonal connector whose vertical segment runs at `trunkX`.
 * Each end leaves its table from the edge facing the vertical segment.
 */
function orthogonalPath(x1, y1, x2, y2, width, trunkX, maxRadius) {
  const sx = trunkX < x1 + width / 2 ? x1 : x1 + width;
  const ex = trunkX < x2 + width / 2 ? x2 : x2 + width;
  const r = Math.min(
    maxRadius,
    Math.abs(y2 - y1) / 2,
    Math.abs(trunkX - sx),
    Math.abs(trunkX - ex),
  );
  if (r < 0.5) {
    return `M ${sx} ${y1} L ${trunkX} ${y1} L ${trunkX} ${y2} L ${ex} ${y2}`;
  }
  const dxs = Math.sign(trunkX - sx);
  const dxe = Math.sign(ex - trunkX);
  const dy = Math.sign(y2 - y1);
  return `M ${sx} ${y1} L ${trunkX - dxs * r} ${y1} Q ${trunkX} ${y1} ${trunkX} ${y1 + dy * r} L ${trunkX} ${y2 - dy * r} Q ${trunkX} ${y2} ${trunkX + dxe * r} ${y2} L ${ex} ${y2}`;
}

/**
 * Builds a "fork" path for a composite (multi-column) foreign key: a short
 * stub from every column on each table converges to a vertical collector,
 * the two collectors are joined by a single orthogonal trunk, and the trunk
 * forks back out to the columns on the other table.
 *
 * @param {{
 *   startTable: { x: number, y: number, comment?: string, fields?: any[] },
 *   endTable: { x: number, y: number, comment?: string, fields?: any[] },
 *   startFieldIndices: number[],
 *   endFieldIndices: number[],
 *   midOffset?: number,
 * }} r
 * @returns {{
 *   path: string,
 *   labelPoint: { x: number, y: number },
 *   startCardinality: { x: number, y: number },
 *   endCardinality: { x: number, y: number },
 * } | null}
 */
export function calcCompositePath(
  r,
  tableWidth = 200,
  zoom = 1,
  showComments = true,
) {
  if (!r || !r.startFieldIndices?.length || !r.endFieldIndices?.length) {
    return null;
  }

  const width = tableWidth * zoom;
  const anchorY = (table, index) =>
    table.y +
    tableHeaderHeight +
    getCommentHeight(table.comment, tableWidth, showComments) +
    getFieldOffsetY(table.fields ?? [], index, tableWidth, showComments) +
    tableFieldHeight / 2;

  const startYs = r.startFieldIndices.map((i) => anchorY(r.startTable, i));
  const endYs = r.endFieldIndices.map((i) => anchorY(r.endTable, i));

  // Connect each table on the edge facing the other table.
  const startCenter = r.startTable.x + width / 2;
  const endCenter = r.endTable.x + width / 2;
  const startIsLeft = startCenter <= endCenter;
  const startX = startIsLeft ? r.startTable.x + width : r.startTable.x;
  const endX = startIsLeft ? r.endTable.x : r.endTable.x + width;
  const dir = startIsLeft ? 1 : -1;
  const fork = 24 * zoom;
  const mergeStartX = startX + dir * fork;
  const mergeEndX = endX - dir * fork;

  const minS = Math.min(...startYs);
  const maxS = Math.max(...startYs);
  const minE = Math.min(...endYs);
  const maxE = Math.max(...endYs);
  const trunkStartY = (minS + maxS) / 2;
  const trunkEndY = (minE + maxE) / 2;
  const midX = (mergeStartX + mergeEndX) / 2 + (r.midOffset ?? 0);

  const radius = 10 * zoom;

  // A column branch: horizontal stub from the table edge to the collector x,
  // a rounded corner, then a vertical run down to the trunk level. Branches
  // overlap on the collector x, reading as a single fork that converges into
  // the trunk.
  const branch = (fromX, fromY, cornerX, toY) => {
    if (Math.abs(fromY - toY) < 0.5) {
      return `M ${fromX} ${fromY} L ${cornerX} ${toY}`;
    }
    const dx = Math.sign(cornerX - fromX);
    const dy = Math.sign(toY - fromY);
    const r = Math.min(radius, Math.abs(toY - fromY), Math.abs(cornerX - fromX));
    return `M ${fromX} ${fromY} L ${cornerX - dx * r} ${fromY} Q ${cornerX} ${fromY} ${cornerX} ${fromY + dy * r} L ${cornerX} ${toY}`;
  };

  // The trunk: a rounded orthogonal connector between the two collectors,
  // its vertical run at midX.
  const trunk = (sx, sy, ex, ey) => {
    if (Math.abs(sy - ey) < 0.5) {
      return `M ${sx} ${sy} L ${ex} ${ey}`;
    }
    const mx = midX;
    const dxs = Math.sign(mx - sx);
    const dxe = Math.sign(ex - mx);
    const dy = Math.sign(ey - sy);
    const r = Math.min(
      radius,
      Math.abs(ey - sy) / 2,
      Math.abs(mx - sx) || radius,
      Math.abs(ex - mx) || radius,
    );
    return `M ${sx} ${sy} L ${mx - dxs * r} ${sy} Q ${mx} ${sy} ${mx} ${sy + dy * r} L ${mx} ${ey - dy * r} Q ${mx} ${ey} ${mx + dxe * r} ${ey} L ${ex} ${ey}`;
  };

  const segs = [];
  // Each start column forks into the trunk.
  startYs.forEach((y) => segs.push(branch(startX, y, mergeStartX, trunkStartY)));
  // Single trunk between the two collectors.
  segs.push(trunk(mergeStartX, trunkStartY, mergeEndX, trunkEndY));
  // Each end column forks out of the trunk.
  endYs.forEach((y) => segs.push(branch(endX, y, mergeEndX, trunkEndY)));

  return {
    path: segs.join(" "),
    labelPoint: { x: midX, y: (trunkStartY + trunkEndY) / 2 },
    startCardinality: { x: mergeStartX, y: trunkStartY },
    endCardinality: { x: mergeEndX, y: trunkEndY },
  };
}
