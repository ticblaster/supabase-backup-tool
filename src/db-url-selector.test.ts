import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { ProjectConfig } from "./config.js";
import { resolveDbUrlEnvNames } from "./config.js";
import { Logger } from "./logger.js";
import {
  auditProjectDbUrlEnvs,
  classifyConnectionFailure,
  selectWorkingDbUrl,
  type DbConnectionTester,
} from "./db-url-selector.js";

const logger = new Logger();

const baseProject: ProjectConfig = {
  projectRef: "test-ref",
  dbUrlEnv: "GERAL_HOMOLOGACAO_DB_URL",
  db: { engine: "pgdump" },
};

const poolerUrl =
  "postgresql://postgres.ref:POOLER_SECRET@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";
const directUrl =
  "postgresql://postgres:DIRECT_SECRET@db.ref.supabase.co:5432/postgres";

function projectWithCandidates(): ProjectConfig {
  return {
    ...baseProject,
    dbUrlEnvCandidates: [
      "GERAL_HOMOLOGACAO_DB_URL_POOLER",
      "GERAL_HOMOLOGACAO_DB_URL_DIRECT",
    ],
  };
}

function setEnv(vars: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  setEnv({
    GERAL_HOMOLOGACAO_DB_URL: undefined,
    GERAL_HOMOLOGACAO_DB_URL_POOLER: undefined,
    GERAL_HOMOLOGACAO_DB_URL_DIRECT: undefined,
  });
});

describe("resolveDbUrlEnvNames", () => {
  it("dbUrlEnvCandidates tem prioridade sobre dbUrlEnv", () => {
    const names = resolveDbUrlEnvNames(projectWithCandidates());
    assert.deepEqual(names, [
      "GERAL_HOMOLOGACAO_DB_URL_POOLER",
      "GERAL_HOMOLOGACAO_DB_URL_DIRECT",
    ]);
  });

  it("config antiga usa apenas dbUrlEnv", () => {
    const names = resolveDbUrlEnvNames(baseProject);
    assert.deepEqual(names, ["GERAL_HOMOLOGACAO_DB_URL"]);
  });
});

describe("auditProjectDbUrlEnvs", () => {
  it("marca env ausente como missing sem erro quando outra existe", () => {
    setEnv({
      GERAL_HOMOLOGACAO_DB_URL_POOLER: poolerUrl,
    });

    const audit = auditProjectDbUrlEnvs(projectWithCandidates());
    assert.equal(audit.configured.length, 1);
    assert.deepEqual(audit.missing, ["GERAL_HOMOLOGACAO_DB_URL_DIRECT"]);
    assert.match(audit.configured[0].masked, /:\*\*\*\*@/);
    assert.doesNotMatch(audit.configured[0].masked, /POOLER_SECRET/);
  });
});

describe("classifyConnectionFailure", () => {
  it("identifica erro de autenticação", () => {
    assert.equal(
      classifyConnectionFailure("FATAL: password authentication failed for user"),
      "auth",
    );
  });

  it("identifica erro de DNS/conexão", () => {
    assert.equal(
      classifyConnectionFailure(
        "could not translate host name \"db.ref.supabase.co\" to address",
      ),
      "connection",
    );
  });
});

describe("selectWorkingDbUrl", () => {
  it("usa segunda URL quando a primeira falha por conexão", async () => {
    setEnv({
      GERAL_HOMOLOGACAO_DB_URL_POOLER: poolerUrl,
      GERAL_HOMOLOGACAO_DB_URL_DIRECT: directUrl,
    });

    const tester: DbConnectionTester = async (dbUrl) => {
      if (dbUrl === poolerUrl) {
        return {
          ok: false,
          exitCode: 2,
          combined:
            'could not translate host name "aws-0-sa-east-1.pooler.supabase.com" to address',
        };
      }
      return { ok: true, exitCode: 0, combined: "1" };
    };

    const selected = await selectWorkingDbUrl(
      projectWithCandidates(),
      logger,
      tester,
    );

    assert.equal(selected.selectedDbUrlEnv, "GERAL_HOMOLOGACAO_DB_URL_DIRECT");
    assert.equal(selected.url, directUrl);
    assert.match(selected.selectedDbUrlMasked, /:\*\*\*\*@/);
  });

  it("erro de autenticação interrompe o processo", async () => {
    setEnv({
      GERAL_HOMOLOGACAO_DB_URL_POOLER: poolerUrl,
      GERAL_HOMOLOGACAO_DB_URL_DIRECT: directUrl,
    });

    const tester: DbConnectionTester = async () => ({
      ok: false,
      exitCode: 2,
      combined: "FATAL: password authentication failed for user \"postgres\"",
    });

    await assert.rejects(
      () => selectWorkingDbUrl(projectWithCandidates(), logger, tester),
      /autenticação/i,
    );
  });

  it("funciona com config antiga dbUrlEnv", async () => {
    setEnv({
      GERAL_HOMOLOGACAO_DB_URL: poolerUrl,
    });

    const tester: DbConnectionTester = async () => ({
      ok: true,
      exitCode: 0,
      combined: "1",
    });

    const selected = await selectWorkingDbUrl(baseProject, logger, tester);
    assert.equal(selected.selectedDbUrlEnv, "GERAL_HOMOLOGACAO_DB_URL");
    assert.equal(selected.url, poolerUrl);
  });
});