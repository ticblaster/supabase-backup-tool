import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDbDumpSteps } from "./build-db-dump-args.js";

const DB_URL =
  "postgresql://postgres.ref:secret@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";
const OUT_DIR = "/tmp/backup/db";

describe("backup usa mesma URL em roles/schema/data", () => {
  it("pgdump repete --dbname em todos os passos", () => {
    const steps = buildDbDumpSteps("pgdump", DB_URL, OUT_DIR, undefined, "npx supabase");

    for (const step of steps) {
      const index = step.args.indexOf("--dbname");
      assert.ok(index >= 0, `${step.label} deve conter --dbname`);
      assert.equal(step.args[index + 1], DB_URL);
    }
  });

  it("supabase-cli repete --db-url em todos os passos", () => {
    const steps = buildDbDumpSteps(
      "supabase-cli",
      DB_URL,
      OUT_DIR,
      undefined,
      "npx supabase",
    );

    for (const step of steps) {
      const index = step.args.indexOf("--db-url");
      assert.ok(index >= 0, `${step.label} deve conter --db-url`);
      assert.equal(step.args[index + 1], DB_URL);
    }
  });
});