import { Action, ObjectType } from "../../../data/constants";
import { Input, Button, Popover } from "@douyinfe/semi-ui";
import { IconMore, IconDeleteStroked } from "@douyinfe/semi-icons";
import { useDiagram, useLayout, useUndoRedo } from "../../../hooks";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";

export default function CustomConstraintDetails({ data, cid, tid }) {
  const { t } = useTranslation();
  const { layout } = useLayout();
  const { tables, updateTable } = useDiagram();
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

  return (
    <div className="flex justify-between items-center mb-2">
      <Input
        value={data.definition}
        placeholder={t("constraint_definition")}
        readonly={layout.readOnly}
        validateStatus={data.definition.trim() === "" ? "error" : "default"}
        className="w-full font-mono"
        onFocus={() => setEditField({ definition: data.definition })}
        onChange={(value) => updateConstraint({ definition: value })}
        onBlur={(e) =>
          pushEdit("definition", e.target.value, "[custom constraint]")
        }
      />
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
        <Button
          icon={<IconMore />}
          type="tertiary"
          style={{ marginLeft: "12px" }}
        />
      </Popover>
    </div>
  );
}
