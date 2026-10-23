import { useCallback } from "react";
import useDiagram from "./useDiagram";
import useSettings from "./useSettings";
import useTransform from "./useTransform";
import { getTableHeight } from "../utils/utils";

/**
 * Returns a function that pans the canvas so the given table is centered,
 * keeping the current zoom.
 */
export default function useFocusTable() {
  const { tables, relationships } = useDiagram();
  const { settings } = useSettings();
  const { setTransform } = useTransform();

  return useCallback(
    (tableId) => {
      const table = tables.find((t) => t.id === tableId);
      if (!table || table.hidden) return;

      const height = getTableHeight(
        table,
        settings.tableWidth,
        settings.showComments,
        relationships,
      );
      setTransform((prev) => ({
        ...prev,
        pan: {
          x: table.x + settings.tableWidth / 2,
          y: table.y + height / 2,
        },
      }));
    },
    [
      tables,
      relationships,
      settings.tableWidth,
      settings.showComments,
      setTransform,
    ],
  );
}
