import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { Manifest } from "./manifest.js";
import { CIRCULAR_FK_MANIFEST_WARNING } from "./pgdump-warnings.js";
import { writeRestoreNotes } from "./restore-notes.js";

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "restore-notes-test-"));

after(async () => {
  await fs.remove(tempDir);
});

function baseManifest(warnings: string[]): Manifest {
  return {
    tool: "supabase-backup-tool",
    version: "0.1.0",
    createdAt: "2026-06-29T19:18:24.000Z",
    projectName: "geral-homologacao",
    projectRef: "test-ref",
    backupType: "db-only",
    paths: {
      roles: "db/roles.sql",
      schema: "db/schema.sql",
      data: "db/data.sql",
    },
    files: [],
    warnings,
  };
}

describe("writeRestoreNotes", () => {
  it("inclui seção de foreign keys circulares quando warning está no manifest", async () => {
    const backupDir = path.join(tempDir, "with-circular-fk");
    await fs.ensureDir(backupDir);

    await writeRestoreNotes(
      backupDir,
      baseManifest([
        "default warning",
        CIRCULAR_FK_MANIFEST_WARNING,
      ]),
    );

    const content = await fs.readFile(
      path.join(backupDir, "restore-notes.md"),
      "utf8",
    );
    assert.match(content, /## Atenção: foreign keys circulares/);
    assert.match(content, /SET session_replication_role = replica/);
  });

  it("omite seção de foreign keys circulares sem warning", async () => {
    const backupDir = path.join(tempDir, "without-circular-fk");
    await fs.ensureDir(backupDir);

    await writeRestoreNotes(backupDir, baseManifest(["default warning"]));

    const content = await fs.readFile(
      path.join(backupDir, "restore-notes.md"),
      "utf8",
    );
    assert.doesNotMatch(content, /## Atenção: foreign keys circulares/);
  });
});