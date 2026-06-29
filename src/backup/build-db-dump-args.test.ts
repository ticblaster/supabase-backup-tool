import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDbDumpSteps,
  buildPgdumpDbDumpSteps,
  buildSupabaseDbDumpSteps,
  validateDbDumpSteps,
} from "./build-db-dump-args.js";

const DB_URL = "postgresql://postgres.test:secret@host:5432/postgres";
const OUT_DIR = "/tmp/backup/db";
const EXCLUDES = ["storage.buckets_vectors", "storage.vector_indexes"];

describe("buildSupabaseDbDumpSteps", () => {
  it("roles e schema não recebem -x", () => {
    const steps = buildSupabaseDbDumpSteps(DB_URL, OUT_DIR, EXCLUDES, "supabase");
    const roles = steps.find((s) => s.kind === "roles")!;
    const schema = steps.find((s) => s.kind === "schema")!;
    const data = steps.find((s) => s.kind === "data")!;

    assert.equal(roles.args.includes("--role-only"), true);
    assert.equal(roles.args.includes("-x"), false);
    assert.equal(schema.args.includes("-x"), false);
    assert.equal(data.args.includes("--data-only"), true);
    assert.equal(data.args.filter((arg) => arg === "-x").length, 2);
    assert.doesNotThrow(() => validateDbDumpSteps("supabase-cli", steps));
  });
});

describe("buildPgdumpDbDumpSteps", () => {
  it("monta comandos sem supabase", () => {
    const steps = buildPgdumpDbDumpSteps(DB_URL, OUT_DIR, EXCLUDES);
    const roles = steps.find((s) => s.kind === "roles")!;
    const schema = steps.find((s) => s.kind === "schema")!;
    const data = steps.find((s) => s.kind === "data")!;

    assert.equal(roles.executable, "pg_dumpall");
    assert.equal(schema.executable, "pg_dump");
    assert.equal(data.executable, "pg_dump");
    assert.equal(roles.allowFailure, true);

    assert.equal(roles.args.includes("--exclude-table"), false);
    assert.equal(schema.args.includes("--exclude-table"), false);
    assert.equal(data.args.includes("--data-only"), true);
    assert.equal(data.args.includes("--schema-only"), false);
    assert.deepEqual(
      data.args.filter((arg) => arg === "--exclude-table").length,
      2,
    );
    assert.equal(data.args.includes("storage.buckets_vectors"), true);

    for (const step of steps) {
      assert.notEqual(step.executable, "supabase");
      assert.equal(step.args.includes("db"), false);
      assert.equal(step.args.includes("dump"), false);
    }

    assert.doesNotThrow(() => validateDbDumpSteps("pgdump", steps));
  });

  it("data.sql sem excludeTables não inclui --exclude-table", () => {
    const steps = buildPgdumpDbDumpSteps(DB_URL, OUT_DIR);
    const data = steps.find((s) => s.kind === "data")!;
    assert.equal(data.args.includes("--exclude-table"), false);
  });

  it("falha de roles não bloqueia schema/data (allowFailure só em roles)", () => {
    const steps = buildPgdumpDbDumpSteps(DB_URL, OUT_DIR, EXCLUDES);
    const roles = steps.find((s) => s.kind === "roles")!;
    const schema = steps.find((s) => s.kind === "schema")!;
    const data = steps.find((s) => s.kind === "data")!;

    assert.equal(roles.allowFailure, true);
    assert.equal(schema.allowFailure, undefined);
    assert.equal(data.allowFailure, undefined);
  });

  it("roles usa pg_dumpall com flags esperadas", () => {
    const steps = buildPgdumpDbDumpSteps(DB_URL, OUT_DIR);
    const roles = steps.find((s) => s.kind === "roles")!;
    assert.deepEqual(roles.args, [
      "--roles-only",
      "--no-role-passwords",
      "--dbname",
      DB_URL,
      "--file",
      `${OUT_DIR}/roles.sql`,
    ]);
  });
});

describe("buildDbDumpSteps", () => {
  it("default engine pgdump via buildDbDumpSteps", () => {
    const steps = buildDbDumpSteps("pgdump", DB_URL, OUT_DIR, EXCLUDES, "npx supabase");
    assert.equal(steps[0].executable, "pg_dumpall");
  });

  it("supabase-cli usa npx supabase quando configurado", () => {
    const steps = buildDbDumpSteps(
      "supabase-cli",
      DB_URL,
      OUT_DIR,
      EXCLUDES,
      "npx supabase",
    );
    assert.equal(steps[0].executable, "npx");
    assert.equal(steps[0].args[0], "supabase");
  });
});