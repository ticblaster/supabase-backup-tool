import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveDbUrlEnvNames,
  validateProjectDbUrlConfig,
  type ProjectConfig,
} from "./config.js";

const baseProject: ProjectConfig = {
  projectRef: "ref",
  dbUrlEnv: "GERAL_HOMOLOGACAO_DB_URL",
};

describe("validateProjectDbUrlConfig", () => {
  it("projeto apenas com dbUrlEnvCandidates passa", () => {
    assert.doesNotThrow(() =>
      validateProjectDbUrlConfig(
        {
          dbUrlEnvCandidates: [
            "GERAL_HOMOLOGACAO_DB_URL_POOLER",
            "GERAL_HOMOLOGACAO_DB_URL_DIRECT",
          ],
        },
        "geral-homologacao",
      ),
    );
  });

  it("projeto apenas com dbUrlEnv passa", () => {
    assert.doesNotThrow(() =>
      validateProjectDbUrlConfig({ dbUrlEnv: "GERAL_HOMOLOGACAO_DB_URL" }, "legacy"),
    );
  });

  it("projeto com os dois passa (candidates tem prioridade na resolução)", () => {
    const project: ProjectConfig = {
      projectRef: "ref",
      dbUrlEnv: "GERAL_HOMOLOGACAO_DB_URL",
      dbUrlEnvCandidates: ["GERAL_HOMOLOGACAO_DB_URL_POOLER"],
    };
    assert.doesNotThrow(() => validateProjectDbUrlConfig(project, "both"));
    assert.deepEqual(resolveDbUrlEnvNames(project), [
      "GERAL_HOMOLOGACAO_DB_URL_POOLER",
    ]);
  });

  it("projeto sem ambos falha", () => {
    assert.throws(
      () => validateProjectDbUrlConfig({}, "sem-url"),
      /nenhuma URL de banco configurada/,
    );
  });
});