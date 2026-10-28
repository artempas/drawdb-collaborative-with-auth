import { Collapse } from "@douyinfe/semi-ui";
import { useSelect, useDiagram, useSaveState, useLayout } from "../../../hooks";
import Empty from "../Empty";
import SearchBar from "./SearchBar";
import RelationshipInfo from "./RelationshipInfo";
import { Constraint, ObjectType, State } from "../../../data/constants";
import { useTranslation } from "react-i18next";
import { SortableList } from "../../SortableList/SortableList";
import { DragHandle } from "../../SortableList/DragHandle";

export default function RelationshipsTab() {
  const { relationships, setRelationships } = useDiagram();
  const { selectedElement, setSelectedElement } = useSelect();
  const { setSaveState } = useSaveState();
  const { layout } = useLayout();
  const { t } = useTranslation();

  return (
    <>
      <SearchBar />
      {relationships.length <= 0 ? (
        <Empty
          title={t("no_relationships")}
          text={t("no_relationships_text")}
        />
      ) : (
        <Collapse
          activeKey={
            selectedElement.open &&
            selectedElement.element === ObjectType.RELATIONSHIP
              ? `${selectedElement.id}`
              : ""
          }
          keepDOM={false}
          lazyRender
          onChange={(k) => {
            setSelectedElement((prev) => ({
              ...prev,
              open: true,
              id: k[0],
              element: ObjectType.RELATIONSHIP,
            }));
          }}
          accordion
        >
          <SortableList
            keyPrefix="relationships-tab"
            items={relationships}
            onChange={(newRelationships) => setRelationships(newRelationships)}
            afterChange={() => setSaveState(State.SAVING)}
            renderItem={(item) => (
              <div id={`scroll_ref_${item.id}`} key={"relationship_" + item.id}>
                <Collapse.Panel
                  className="relative"
                  header={
                    <div className="w-full flex items-center gap-2">
                      <DragHandle readOnly={layout.readOnly} id={item.id} />
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                        {item.name}
                      </div>
                      {(item.updateConstraint === Constraint.NONE ||
                        item.deleteConstraint === Constraint.NONE) && (
                        <span
                          className="shrink-0 w-2 h-2 rounded-full bg-amber-500"
                          title={`${t("on_update")} / ${t("on_delete")}: ${Constraint.NONE}`}
                        />
                      )}
                    </div>
                  }
                  itemKey={`${item.id}`}
                >
                  <RelationshipInfo data={item} />
                </Collapse.Panel>
              </div>
            )}
          />
        </Collapse>
      )}
    </>
  );
}
