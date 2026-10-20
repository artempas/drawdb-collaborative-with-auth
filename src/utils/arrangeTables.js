import {
  Cardinality,
  tableWidth as defaultTableWidth,
} from "../data/constants";
import { computeLayout, LayoutType } from "./autoLayout/index.js";
import { getTableHeight } from "./utils";

/**
 * Computes new positions for the diagram tables with the given layout style.
 *
 * @returns {Map<any, { x: number, y: number }>} top-left position per table id
 */
export function layoutDiagramTables(
  type,
  tables,
  relationships = [],
  { tableWidth = defaultTableWidth, showComments = true } = {},
) {
  const nodes = tables.map((table) => ({
    id: table.id,
    w: tableWidth,
    h: getTableHeight(table, tableWidth, showComments, relationships),
  }));
  // Edges point from the table holding the foreign key (the "many" side) to
  // the referenced table. One-to-many relationships store it as the end.
  const edges = relationships.map((r) =>
    r.cardinality === Cardinality.ONE_TO_MANY
      ? { source: r.endTableId, target: r.startTableId }
      : { source: r.startTableId, target: r.endTableId },
  );
  return computeLayout(type, nodes, edges);
}

export function arrangeTables(diagram) {
  const positions = layoutDiagramTables(
    LayoutType.HIERARCHICAL,
    diagram.tables,
    diagram.relationships,
  );
  diagram.tables.forEach((table) => {
    Object.assign(table, positions.get(table.id));
  });
}
