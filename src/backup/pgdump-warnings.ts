export const CIRCULAR_FK_OUTPUT_MARKER =
  "there are circular foreign-key constraints";

export const CIRCULAR_FK_MANIFEST_WARNING =
  "pg_dump reported circular foreign-key constraints in data dump; SET session_replication_role = replica may be required during restore.";

export function detectCircularForeignKeys(output: string): boolean {
  return output.toLowerCase().includes(CIRCULAR_FK_OUTPUT_MARKER);
}

export function hasCircularForeignKeyWarning(
  warnings: readonly string[],
): boolean {
  return warnings.includes(CIRCULAR_FK_MANIFEST_WARNING);
}

export function buildCircularForeignKeysRestoreSection(): string {
  return `## Atenção: foreign keys circulares

O dump de dados indicou tabelas com foreign keys circulares. Durante restore, pode ser necessário usar:
SET session_replication_role = replica;

Ou restaurar schema e dados em uma estratégia controlada.`;
}