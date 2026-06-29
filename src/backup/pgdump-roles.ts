export const ROLES_PLACEHOLDER_HEADER = "-- roles.sql não gerado automaticamente.";

export function buildRolesPlaceholder(reason: string): string {
  return [
    ROLES_PLACEHOLDER_HEADER,
    `-- Motivo: ${reason}`,
    "-- Para projetos Supabase, roles gerenciadas podem exigir recriação manual/validação no restore.",
    "",
  ].join("\n");
}