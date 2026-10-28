import { useMemo, useRef, useState, useEffect } from "react";
import { Action, Cardinality, Constraint, ObjectType, Tab } from "../../data/constants";
import { calcPath, calcCompositePath } from "../../utils/calcPath";
import {
  useDiagram,
  useSettings,
  useLayout,
  useSelect,
  useCanvas,
  useTransform,
  useFocusTable,
  useUndoRedo,
} from "../../hooks";
import { useTranslation } from "react-i18next";
import { SideSheet } from "@douyinfe/semi-ui";
import RelationshipInfo from "../EditorSidePanel/RelationshipsTab/RelationshipInfo";
import {
  getVisibleFieldIndex,
  getVisibleFields,
  getRelationshipFields,
} from "../../utils/utils";

const labelFontSize = 16;

export default function Relationship({ data }) {
  const { settings } = useSettings();
  const { tables, relationships, updateRelationship } = useDiagram();
  const { layout } = useLayout();
  const { selectedElement, setSelectedElement, setBulkSelectedElements } =
    useSelect();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const { t } = useTranslation();

  const pathValues = useMemo(() => {
    const startTable = tables.find((t) => t.id === data.startTableId);
    const endTable = tables.find((t) => t.id === data.endTableId);

    if (!startTable || !endTable || startTable.hidden || endTable.hidden)
      return null;

    const startFields = getVisibleFields(startTable, relationships);
    const endFields = getVisibleFields(endTable, relationships);

    const pairs = getRelationshipFields(data);

    return {
      startFieldIndex: getVisibleFieldIndex(
        startTable,
        data.startFieldId,
        relationships,
      ),
      endFieldIndex: getVisibleFieldIndex(
        endTable,
        data.endFieldId,
        relationships,
      ),
      startFieldIndices: pairs.map((p) =>
        getVisibleFieldIndex(startTable, p.startFieldId, relationships),
      ),
      endFieldIndices: pairs.map((p) =>
        getVisibleFieldIndex(endTable, p.endFieldId, relationships),
      ),
      startTable: {
        x: startTable.x,
        y: startTable.y,
        comment: startTable.comment,
        fields: startFields,
      },
      endTable: {
        x: endTable.x,
        y: endTable.y,
        comment: endTable.comment,
        fields: endFields,
      },
      midOffset: data.midOffset ?? 0,
    };
  }, [tables, relationships, data]);

  const hasNoAction =
    data.updateConstraint === Constraint.NONE ||
    data.deleteConstraint === Constraint.NONE;

  const isComposite = (pathValues?.startFieldIndices?.length ?? 0) > 1;

  const composite = useMemo(() => {
    if (!pathValues || !isComposite) return null;
    return calcCompositePath(
      {
        startTable: pathValues.startTable,
        endTable: pathValues.endTable,
        startFieldIndices: pathValues.startFieldIndices,
        endFieldIndices: pathValues.endFieldIndices,
        midOffset: pathValues.midOffset,
      },
      settings.tableWidth,
      1,
      settings.showComments,
    );
  }, [pathValues, isComposite, settings.tableWidth, settings.showComments]);

  const pathRef = useRef();
  const labelRef = useRef();

  let cardinalityStart = "1";
  let cardinalityEnd = "1";

  switch (data.cardinality) {
    // the translated values are to ensure backwards compatibility
    case t(Cardinality.MANY_TO_ONE):
    case Cardinality.MANY_TO_ONE:
      cardinalityStart = data.manyLabel || "n";
      cardinalityEnd = "1";
      break;
    case t(Cardinality.ONE_TO_MANY):
    case Cardinality.ONE_TO_MANY:
      cardinalityStart = "1";
      cardinalityEnd = data.manyLabel || "n";
      break;
    case t(Cardinality.ONE_TO_ONE):
    case Cardinality.ONE_TO_ONE:
      cardinalityStart = "1";
      cardinalityEnd = "1";
      break;
    default:
      break;
  }

  let cardinalityStartX = 0;
  let cardinalityEndX = 0;
  let cardinalityStartY = 0;
  let cardinalityEndY = 0;
  let labelX = 0;
  let labelY = 0;

  let labelWidth = labelRef.current?.getBBox().width ?? 0;
  let labelHeight = labelRef.current?.getBBox().height ?? 0;

  const cardinalityOffset = 28;

  if (composite) {
    labelX = composite.labelPoint.x - (labelWidth ?? 0) / 2;
    labelY = composite.labelPoint.y + (labelHeight ?? 0) / 2;
    cardinalityStartX = composite.startCardinality.x;
    cardinalityStartY = composite.startCardinality.y;
    cardinalityEndX = composite.endCardinality.x;
    cardinalityEndY = composite.endCardinality.y;
  } else if (pathRef.current) {
    const pathLength = pathRef.current.getTotalLength();

    const labelPoint = pathRef.current.getPointAtLength(pathLength / 2);
    labelX = labelPoint.x - (labelWidth ?? 0) / 2;
    labelY = labelPoint.y + (labelHeight ?? 0) / 2;

    const point1 = pathRef.current.getPointAtLength(cardinalityOffset);
    cardinalityStartX = point1.x;
    cardinalityStartY = point1.y;
    const point2 = pathRef.current.getPointAtLength(
      pathLength - cardinalityOffset,
    );
    cardinalityEndX = point2.x;
    cardinalityEndY = point2.y;
  }

  const isSelected =
    selectedElement.element === ObjectType.RELATIONSHIP &&
    selectedElement.id === data.id;

  // Points just inside both ends of the arc, used to place the jump badges.
  // Each badge sits clear of the cardinality label, and `tip` is the actual
  // end of the arc, so the badge arrow can point towards its table.
  let jumpEnds = null;
  if (isSelected && composite) {
    const dir =
      Math.sign(composite.endCardinality.x - composite.startCardinality.x) || 1;
    jumpEnds = {
      start: {
        x: composite.startCardinality.x - dir * 36,
        y: composite.startCardinality.y,
        tip: composite.startCardinality,
      },
      end: {
        x: composite.endCardinality.x + dir * 36,
        y: composite.endCardinality.y,
        tip: composite.endCardinality,
      },
    };
  } else if (isSelected && pathRef.current) {
    const pathLength = pathRef.current.getTotalLength();
    const offset = Math.min(64, pathLength / 4);
    const at = (length) => {
      const { x, y } = pathRef.current.getPointAtLength(length);
      return { x, y };
    };
    jumpEnds = {
      start: { ...at(offset), tip: at(0) },
      end: { ...at(pathLength - offset), tip: at(pathLength) },
    };
  }

  const select = () => {
    setSelectedElement((prev) => ({
      ...prev,
      element: ObjectType.RELATIONSHIP,
      id: data.id,
      open: false,
    }));
  };

  // Dragging the arc shifts its vertical segment horizontally. The shift is
  // stored relative to the default route, so it follows the tables around.
  const dragRef = useRef(null);

  const pointerDiagramX = (e) => {
    const svg = e.currentTarget.ownerSVGElement;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svg.getScreenCTM().inverse(),
    ).x;
  };

  const startDrag = (e) => {
    if (layout.readOnly || !e.isPrimary || e.button !== 0) return;
    if (selectedElement.open && !layout.sidebar) return;
    // keep the canvas from starting a selection rectangle
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setBulkSelectedElements([]);
    const offset = data.midOffset ?? 0;
    dragRef.current = {
      startX: pointerDiagramX(e),
      startOffset: offset,
      offset,
    };
  };

  const drag = (e) => {
    const state = dragRef.current;
    if (!state) return;
    e.stopPropagation();
    const offset = Math.round(
      state.startOffset + pointerDiagramX(e) - state.startX,
    );
    if (offset === state.offset) return;
    state.offset = offset;
    updateRelationship(data.id, { midOffset: offset });
  };

  const endDrag = () => {
    const state = dragRef.current;
    if (!state) return;
    dragRef.current = null;
    if (state.offset === state.startOffset) return;
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.RELATIONSHIP,
        component: "self",
        rid: data.id,
        undo: { midOffset: state.startOffset },
        redo: { midOffset: state.offset },
        message: t("edit_relationship", {
          refName: data.name,
          extra: "[path]",
        }),
      },
    ]);
    setRedoStack([]);
  };

  const edit = () => {
    if (!layout.sidebar) {
      setSelectedElement((prev) => ({
        ...prev,
        element: ObjectType.RELATIONSHIP,
        id: data.id,
        open: true,
      }));
    } else {
      setSelectedElement((prev) => ({
        ...prev,
        currentTab: Tab.RELATIONSHIPS,
        element: ObjectType.RELATIONSHIP,
        id: data.id,
        open: true,
      }));
      if (selectedElement.currentTab !== Tab.RELATIONSHIPS) return;
      document
        .getElementById(`scroll_ref_${data.id}`)
        .scrollIntoView({ behavior: "smooth" });
    }
  };

  if (!pathValues) return null;

  return (
    <>
      <g
        className="select-none group"
        data-relationship-ui
        onClick={select}
        onDoubleClick={edit}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* invisible wider path for better hover ux */}
        <path
          d={
            composite
              ? composite.path
              : calcPath(
                  pathValues,
                  settings.tableWidth,
                  1,
                  settings.showComments,
                )
          }
          fill="none"
          stroke="transparent"
          strokeWidth={12}
          cursor={layout.readOnly ? "pointer" : "col-resize"}
        />
        <path
          ref={pathRef}
          d={
            composite
              ? composite.path
              : calcPath(
                  pathValues,
                  settings.tableWidth,
                  1,
                  settings.showComments,
                )
          }
          className={`relationship-path${hasNoAction ? " no-action" : ""}`}
          fill="none"
          cursor={layout.readOnly ? "pointer" : "col-resize"}
        />
        {settings.showRelationshipLabels && (
          <text
            x={labelX}
            y={labelY}
            fill={settings.mode === "dark" ? "lightgrey" : "#333"}
            fontSize={labelFontSize}
            fontWeight={500}
            ref={labelRef}
            className="group-hover:fill-sky-600"
          >
            {data.name}
          </text>
        )}
        {(composite || pathRef.current) && settings.showCardinality && (
          <>
            <CardinalityLabel
              x={cardinalityStartX}
              y={cardinalityStartY}
              text={cardinalityStart}
            />
            <CardinalityLabel
              x={cardinalityEndX}
              y={cardinalityEndY}
              text={cardinalityEnd}
            />
          </>
        )}
      </g>
      {jumpEnds && (
        <JumpBadges
          ends={jumpEnds}
          startTable={tables.find((tbl) => tbl.id === data.startTableId)}
          endTable={tables.find((tbl) => tbl.id === data.endTableId)}
        />
      )}
      <SideSheet
        title={t("edit")}
        size="small"
        visible={
          selectedElement.element === ObjectType.RELATIONSHIP &&
          selectedElement.id === data.id &&
          selectedElement.open &&
          !layout.sidebar
        }
        onCancel={() => {
          setSelectedElement((prev) => ({
            ...prev,
            open: false,
          }));
        }}
        style={{ paddingBottom: "16px" }}
      >
        <div className="sidesheet-theme">
          <RelationshipInfo data={data} />
        </div>
      </SideSheet>
    </>
  );
}

const jumpBadgeRadius = 14;
const jumpBadgeMargin = 8;

// One badge per arc end. Rendered only for the selected arc so panning does
// not re-render every arc. A badge whose end is off-screen is pinned to the
// edge of the visible area, pointing towards its table.
function JumpBadges({ ends, startTable, endTable }) {
  const { canvas } = useCanvas();
  const { transform } = useTransform();
  const focusTable = useFocusTable();
  const { t } = useTranslation();

  const scale = 1 / transform.zoom;
  const inset = (jumpBadgeRadius + jumpBadgeMargin) * scale;
  const { viewBox } = canvas;

  const badge = (end, table) => {
    if (!table) return null;
    const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
    const x = clamp(end.x, viewBox.left + inset, viewBox.right - inset);
    const y = clamp(end.y, viewBox.top + inset, viewBox.bottom - inset);
    const angle = (Math.atan2(end.tip.y - y, end.tip.x - x) * 180) / Math.PI;
    const label = t("go_to_table", { name: table.name });

    return (
      <g
        key={table.id + ":" + end.tip.x}
        transform={`translate(${x} ${y}) scale(${scale})`}
        cursor="pointer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          focusTable(table.id);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <title>{label}</title>
        <circle
          r={jumpBadgeRadius}
          className="fill-sky-600 hover:fill-sky-500"
          stroke="white"
          strokeWidth={2}
        />
        <path
          d="M -6 0 H 6 M 1 -5 L 6 0 L 1 5"
          transform={`rotate(${angle})`}
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      </g>
    );
  };

  return (
    <g data-relationship-ui>
      {badge(ends.start, startTable)}
      {badge(ends.end, endTable)}
    </g>
  );
}

function CardinalityLabel({ x, y, text, r = 12, padding = 14 }) {
  const [textWidth, setTextWidth] = useState(0);
  const textRef = useRef(null);

  useEffect(() => {
    if (textRef.current) {
      const bbox = textRef.current.getBBox();
      setTextWidth(bbox.width);
    }
  }, [text]);

  return (
    <g>
      <rect
        x={x - textWidth / 2 - padding / 2}
        y={y - r}
        rx={r}
        ry={r}
        width={textWidth + padding}
        height={r * 2}
        fill="grey"
        className="group-hover:fill-sky-600"
      />
      <text
        ref={textRef}
        x={x}
        y={y}
        fill="white"
        strokeWidth="0.5"
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {text}
      </text>
    </g>
  );
}
