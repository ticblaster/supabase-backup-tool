import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCircularForeignKeysRestoreSection,
  CIRCULAR_FK_MANIFEST_WARNING,
  detectCircularForeignKeys,
  hasCircularForeignKeyWarning,
} from "./pgdump-warnings.js";

describe("pgdump-warnings", () => {
  it("detecta circular foreign-key constraints no stderr do pg_dump", () => {
    const output = `pg_dump: warning: there are circular foreign-key constraints on this table:
pg_dump: detail: key1
`;
    assert.equal(detectCircularForeignKeys(output), true);
  });

  it("não detecta quando ausente", () => {
    assert.equal(detectCircularForeignKeys("dump concluído"), false);
  });

  it("hasCircularForeignKeyWarning reconhece warning do manifest", () => {
    assert.equal(
      hasCircularForeignKeyWarning([
        "outro aviso",
        CIRCULAR_FK_MANIFEST_WARNING,
      ]),
      true,
    );
    assert.equal(hasCircularForeignKeyWarning(["outro aviso"]), false);
  });

  it("buildCircularForeignKeysRestoreSection contém SET session_replication_role", () => {
    const section = buildCircularForeignKeysRestoreSection();
    assert.match(section, /foreign keys circulares/);
    assert.match(section, /SET session_replication_role = replica/);
  });
});