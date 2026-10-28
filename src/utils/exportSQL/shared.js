import { isFunction, isKeyword, getRelationshipFields } from "../utils";

import { DB } from "../../data/constants";
import { dbToTypes } from "../../data/datatypes";

export function getFkColumnNames(relationship, startTable, endTable) {
  const pairs = getRelationshipFields(relationship);
  const startColumns = pairs.map(
    (p) => startTable?.fields.find((f) => f.id === p.startFieldId)?.name,
  );
  const endColumns = pairs.map(
    (p) => endTable?.fields.find((f) => f.id === p.endFieldId)?.name,
  );
  return { startColumns, endColumns };
}

export function parseDefault(field, database = DB.GENERIC) {
  if (
    isFunction(field.default) ||
    isKeyword(field.default) ||
    !dbToTypes[database][field.type].hasQuotes
  ) {
    return field.default;
  }

  return `'${escapeQuotes(field.default)}'`;
}

export function escapeQuotes(str) {
  return str.replace(/[']/g, "'$&");
}

export function exportFieldComment(comment) {
  if (comment === "") {
    return "";
  }

  return comment
    .split("\n")
    .map((commentLine) => `\t-- ${commentLine}\n`)
    .join("");
}

export function hasWhere(uc) {
  return typeof uc.where === "string" && uc.where.trim() !== "";
}

export function supportsPartialUnique(database) {
  return (
    database === DB.POSTGRES ||
    database === DB.SQLITE ||
    database === DB.MSSQL ||
    database === DB.GENERIC
  );
}

export function uniqueConstraintClause(table, quote) {
  const constraints = (table.uniqueConstraints || []).filter(
    (uc) => Array.isArray(uc.fields) && uc.fields.length > 0 && !hasWhere(uc),
  );
  if (constraints.length === 0) return "";

  return (
    ",\n" +
    constraints
      .map(
        (uc) =>
          `\tCONSTRAINT ${quote(uc.name)} UNIQUE (${uc.fields
            .map((f) => quote(f))
            .join(", ")})`,
      )
      .join(",\n")
  );
}

// UNIQUE ... WHERE cannot be a table constraint, so it is emitted as a partial
// unique index after CREATE TABLE (or as a comment where unsupported).
export function partialUniqueStatement(tableName, uc, database, quote) {
  const fields = uc.fields.map((f) => quote(f)).join(", ");
  const where = uc.where.trim();
  if (!supportsPartialUnique(database)) {
    return `-- Partial unique constraint ${uc.name} is not supported by this database: UNIQUE (${uc.fields.join(", ")}) WHERE ${where}`;
  }
  const ifNotExists = database === DB.SQLITE ? "IF NOT EXISTS " : "";
  const stmt = `CREATE UNIQUE INDEX ${ifNotExists}${quote(uc.name)}\nON ${quote(tableName)} (${fields})\nWHERE ${where};`;
  return database === DB.MSSQL ? stmt + "\nGO" : stmt;
}

export function partialUniqueStatements(table, database, quote) {
  const statements = (table.uniqueConstraints || [])
    .filter(
      (uc) => Array.isArray(uc.fields) && uc.fields.length > 0 && hasWhere(uc),
    )
    .map((uc) => partialUniqueStatement(table.name, uc, database, quote));
  return statements.length > 0 ? "\n" + statements.join("\n") : "";
}

export function customConstraintClause(table, quote) {
  const constraints = (table.customConstraints || []).filter(
    (cc) => typeof cc.definition === "string" && cc.definition.trim() !== "",
  );
  if (constraints.length === 0) return "";

  return (
    ",\n" +
    constraints
      .map((cc) =>
        cc.name && cc.name.trim() !== ""
          ? `\tCONSTRAINT ${quote(cc.name)} ${cc.definition.trim()}`
          : `\t${cc.definition.trim()}`,
      )
      .join(",\n")
  );
}

export function getInlineFK(table, obj) {
  let fks = [];
  obj.references.forEach((r) => {
    if (r.startTableId === table.id) {
      const endTable = obj.tables.find((t) => t.id === r.endTableId);
      const { startColumns, endColumns } = getFkColumnNames(
        r,
        table,
        endTable,
      );
      fks.push(
        `\tFOREIGN KEY (${startColumns
          .map((c) => `"${c}"`)
          .join(", ")}) REFERENCES "${endTable?.name}"(${endColumns
          .map((c) => `"${c}"`)
          .join(", ")})\n\tON UPDATE ${r.updateConstraint.toUpperCase()} ON DELETE ${r.deleteConstraint.toUpperCase()}`,
      );
    }
  });
  return fks.join(",\n");
}
