import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { ProjectConfig } from "./config.js";
import { runProjectDbUrlCheck } from "./checks.js";
import type { DbConnectionTester } from "./db-url-selector.js";

const poolerUrl =
  "postgresql://postgres.ref:POOLER_SECRET@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";

function candidatesOnlyProject(): ProjectConfig {
  return {
    projectRef: "izzitgselrzkxsqglcja",
    dbUrlEnvCandidates: [
      "GERAL_HOMOLOGACAO_DB_URL_POOLER",
      "GERAL_HOMOLOGACAO_DB_URL_DIRECT",
    ],
    db: { engine: "pgdump" },
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

describe("runProjectDbUrlCheck", () => {
  it("projeto apenas com dbUrlEnvCandidates passa quando env existe", async () => {
    setEnv({ GERAL_HOMOLOGACAO_DB_URL_POOLER: poolerUrl });

    const result = await runProjectDbUrlCheck(candidatesOnlyProject());
    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.candidateDbUrlEnvs, [
      "GERAL_HOMOLOGACAO_DB_URL_POOLER",
      "GERAL_HOMOLOGACAO_DB_URL_DIRECT",
    ]);
  });

  it("projeto apenas com dbUrlEnv continua passando", async () => {
    setEnv({ GERAL_HOMOLOGACAO_DB_URL: poolerUrl });

    const result = await runProjectDbUrlCheck({
      projectRef: "ref",
      dbUrlEnv: "GERAL_HOMOLOGACAO_DB_URL",
      db: { engine: "pgdump" },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.candidateDbUrlEnvs, ["GERAL_HOMOLOGACAO_DB_URL"]);
  });

  it("candidata ausente gera warning, mas não erro se outra existir", async () => {
    setEnv({ GERAL_HOMOLOGACAO_DB_URL_POOLER: poolerUrl });

    const result = await runProjectDbUrlCheck(candidatesOnlyProject());
    assert.equal(result.ok, true);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /GERAL_HOMOLOGACAO_DB_URL_DIRECT/);
  });

  it("nenhuma candidata no process.env gera erro", async () => {
    const result = await runProjectDbUrlCheck(candidatesOnlyProject());
    assert.equal(result.ok, false);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /nenhuma URL de banco configurada no ambiente/);
  });

  it("--test-db-connection usa seletor de db-url-selector", async () => {
    setEnv({ GERAL_HOMOLOGACAO_DB_URL_POOLER: poolerUrl });

    let selectorCalled = false;
    const mockSelector: DbConnectionTester = async () => {
      selectorCalled = true;
      return { ok: true, exitCode: 0, combined: "1" };
    };

    const result = await runProjectDbUrlCheck(candidatesOnlyProject(), {
      testDbConnection: true,
      dbUrlSelector: async (project, _logger) => {
        const testResult = await mockSelector(poolerUrl);
        assert.equal(testResult.ok, true);
        selectorCalled = true;
        return {
          url: poolerUrl,
          selectedDbUrlEnv: "GERAL_HOMOLOGACAO_DB_URL_POOLER",
          selectedDbUrlMasked:
            "postgresql://postgres.ref:****@aws-0-sa-east-1.pooler.supabase.com:5432/postgres",
          candidateDbUrlEnvs: project.dbUrlEnvCandidates ?? [],
          engine: "pgdump",
        };
      },
    });

    assert.equal(selectorCalled, true);
    assert.equal(result.selectedDbUrlEnv, "GERAL_HOMOLOGACAO_DB_URL_POOLER");
    assert.equal(result.ok, true);
  });
});