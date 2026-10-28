import { Action, ObjectType, DB } from "../../../data/constants";
import { Input, Button, Popover } from "@douyinfe/semi-ui";
import { IconMore, IconDeleteStroked } from "@douyinfe/semi-icons";
import { useDiagram, useLayout, useUndoRedo } from "../../../hooks";
import { useTranslation } from "react-i18next";
import { useMemo, useRef, useState } from "react";
import CodeEditor from "../../CodeEditor";
import { customConstraintAddPrefix } from "../../../utils/migrations/diffToSQL";

const LINE_HEIGHT = 18;
const MIN_LINES = 3;
const MAX_LINES = 8;

export default function CustomConstraintDetails({ data, cid, tid }) {
  const { t } = useTranslation();
  const { layout } = useLayout();
  const { tables, updateTable, database } = useDiagram();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const [editField, setEditField] = useState({});
  const table = useMemo(() => tables.find((t) => t.id === tid), [tables, tid]);

  const constraints = table.customConstraints ?? [];

  const updateConstraint = (values) =>
    updateTable(tid, {
      customConstraints: constraints.map((constraint) =>
        constraint.id === cid ? { ...constraint, ...values } : constraint,
      ),
    });

  const pushEdit = (key, value, extra) => {
    if (value === editField[key]) return;
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "custom_constraint",
        tid: tid,
        cid: cid,
        undo: editField,
        redo: { [key]: value },
        message: t("edit_table", {
          tableName: table.name,
          extra,
        }),
      },
    ]);
    setRedoStack([]);
  };

  // Monaco listeners are registered once on mount, so they go through refs
  // to always see the latest render's state.
  const pushEditRef = useRef(pushEdit);
  pushEditRef.current = pushEdit;
  const definitionRef = useRef(data.definition);
  definitionRef.current = data.definition;

  const handleEditorMount = (editor) => {
    editor.onDidFocusEditorText(() =>
      setEditField({ definition: definitionRef.current }),
    );
    editor.onDidBlurEditorText(() =>
      pushEditRef.current(
        "definition",
        editor.getValue(),
        "[custom constraint]",
      ),
    );
  };

  const migrationPrefix =
    database === DB.SQLITE
      ? data.name.trim() !== ""
        ? `CONSTRAINT "${data.name}"`
        : ""
      : customConstraintAddPrefix(table.name, data.name, database);

  const lines = Math.min(
    MAX_LINES,
    Math.max(MIN_LINES, data.definition.split("\n").length),
  );

  return (
    <div className="mb-3">
      <div className="flex justify-between items-start gap-2 mb-1">
        <code className="text-xs font-mono opacity-70 break-words min-w-0 pt-1">
          {migrationPrefix}
        </code>
        <Popover
          content={
            <div className="px-1 popover-theme">
              <div className="font-semibold mb-1">{t("name")}: </div>
              <Input
                value={data.name}
                placeholder={t("name")}
                readonly={layout.readOnly}
                onFocus={() => setEditField({ name: data.name })}
                onChange={(value) => updateConstraint({ name: value })}
                onBlur={(e) =>
                  pushEdit("name", e.target.value, "[custom constraint]")
                }
              />
              <Button
                block
                type="danger"
                className="mt-2"
                disabled={layout.readOnly}
                icon={<IconDeleteStroked />}
                onClick={() => {
                  setUndoStack((prev) => [
                    ...prev,
                    {
                      action: Action.EDIT,
                      element: ObjectType.TABLE,
                      component: "custom_constraint_delete",
                      tid: tid,
                      data: data,
                      message: t("edit_table", {
                        tableName: table.name,
                        extra: "[delete custom constraint]",
                      }),
                    },
                  ]);
                  setRedoStack([]);
                  updateTable(tid, {
                    customConstraints: constraints
                      .filter((e) => e.id !== cid)
                      .map((e, j) => ({
                        ...e,
                        id: j,
                      })),
                  });
                }}
              >
                {t("delete")}
              </Button>
            </div>
          }
          trigger="click"
          position="rightTop"
          showArrow
        >
          <Button icon={<IconMore />} type="tertiary" size="small" />
        </Popover>
      </div>
      <div
        className={`rounded overflow-hidden border ${
          data.definition.trim() === ""
            ? "border-red-500"
            : "border-zinc-300 dark:border-zinc-600"
        }`}
      >
        <CodeEditor
          language="sql"
          height={lines * LINE_HEIGHT + 8}
          value={data.definition}
          formatOnMount={false}
          onMount={handleEditorMount}
          onChange={(value) => updateConstraint({ definition: value ?? "" })}
          options={{
            readOnly: layout.readOnly,
            minimap: { enabled: false },
            lineNumbers: "off",
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 6,
            lineNumbersMinChars: 0,
            scrollBeyondLastLine: false,
            wordWrap: "on",
            fontSize: 12,
            lineHeight: LINE_HEIGHT,
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: { vertical: "auto", horizontal: "hidden" },
            padding: { top: 4, bottom: 4 },
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
