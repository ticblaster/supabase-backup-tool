import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRolesPlaceholder,
  ROLES_PLACEHOLDER_HEADER,
} from "./pgdump-roles.js";

describe("buildRolesPlaceholder", () => {
  it("gera arquivo de aviso com motivo", () => {
    const content = buildRolesPlaceholder(
      "pg_dumpall indisponível ou permissão insuficiente",
    );

    assert.match(content, new RegExp(ROLES_PLACEHOLDER_HEADER));
    assert.match(content, /pg_dumpall indisponível ou permissão insuficiente/);
    assert.match(content, /recriação manual\/validação no restore/);
  });
});