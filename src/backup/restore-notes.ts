import fs from "fs-extra";
import path from "node:path";
import type { Manifest } from "./manifest.js";
import {
  buildCircularForeignKeysRestoreSection,
  hasCircularForeignKeyWarning,
} from "./pgdump-warnings.js";

export async function writeRestoreNotes(
  backupDir: string,
  manifest: Manifest,
): Promise<string> {
  const created = new Date(manifest.createdAt).toLocaleString("pt-BR");
  const storageSection = buildStorageSection(manifest);
  const circularFkSection = hasCircularForeignKeyWarning(manifest.warnings)
    ? `\n${buildCircularForeignKeysRestoreSection()}\n`
    : "";

  const content = `# Restore notes — ${manifest.projectName}

Backup criado em: ${created}
Project ref: ${manifest.projectRef}
Tipo: ${manifest.backupType}
Ferramenta: ${manifest.tool} v${manifest.version}

> **Atenção:** esta ferramenta não executa restore automático. Siga os passos abaixo em ambiente separado antes de qualquer produção.

## Ordem sugerida

1. Criar novo projeto Supabase ou banco Postgres compatível.
2. Configurar variáveis de ambiente com a connection string de destino (\`TARGET_DB_URL\`).
3. Restaurar roles (\`db/roles.sql\`).
4. Restaurar schema (\`db/schema.sql\`).
5. Restaurar dados (\`db/data.sql\`) com replicação desabilitada temporariamente.
6. Recriar/copiar buckets de Storage, se aplicável.
7. Validar RLS, Auth, Storage e fluxos principais do app.

## Comando sugerido (banco)

\`\`\`bash
psql --single-transaction --variable ON_ERROR_STOP=1 \\
  --file "db/roles.sql" \\
  --file "db/schema.sql" \\
  --command "SET session_replication_role = replica" \\
  --file "db/data.sql" \\
  --dbname "$TARGET_DB_URL"
\`\`\`

No Windows (PowerShell), use caminhos absolutos para os arquivos SQL.
${circularFkSection}
## Storage

${storageSection}

## Validações recomendadas

- Conferir políticas RLS nas tabelas críticas.
- Conferir usuários Auth (não incluídos automaticamente no dump lógico padrão).
- Conferir metadados de buckets e políticas de Storage.
- Executar smoke tests da aplicação contra o ambiente restaurado.

## Avisos do manifesto

${manifest.warnings.map((w) => `- ${w}`).join("\n")}
`;

  const notesPath = path.join(backupDir, "restore-notes.md");
  await fs.writeFile(notesPath, content, "utf8");
  return notesPath;
}

function buildStorageSection(manifest: Manifest): string {
  if (!manifest.storage || manifest.storage.buckets.length === 0) {
    return "Nenhum bucket foi incluído neste backup.";
  }

  const lines = manifest.storage.buckets.map((bucket) => {
    const src = bucket.path;
    if (manifest.storage?.mode === "rclone") {
      return `- Bucket \`${bucket.name}\`: copiar de \`${src}/\` para o destino (ex.: \`rclone copy ${src}/ <remote>:${bucket.name}\`)`;
    }
    return `- Bucket \`${bucket.name}\`: copiar de \`${src}/\` para o bucket equivalente no projeto destino`;
  });

  return [
    `Modo de backup: **${manifest.storage.mode}**`,
    "",
    ...lines,
  ].join("\n");
}

export function printRestoreGuide(backupDir: string, manifest: Manifest): void {
  console.log("");
  console.log(`# Restore guide — ${manifest.projectName}`);
  console.log(`Backup dir: ${backupDir}`);
  console.log(`Criado em: ${manifest.createdAt}`);
  console.log("");
  console.log("1. Defina TARGET_DB_URL com a connection string do banco destino.");
  console.log("2. Restaure roles, schema e data nesta ordem.");
  console.log("3. Copie os buckets listados em storage/, se existirem.");
  console.log("4. Valide Auth, RLS e Storage antes de usar em produção.");
  console.log("");
  console.log("Comando sugerido:");
  console.log(
    'psql --single-transaction --variable ON_ERROR_STOP=1 --file "db/roles.sql" --file "db/schema.sql" --command "SET session_replication_role = replica" --file "db/data.sql" --dbname "$TARGET_DB_URL"',
  );
  console.log("");
  console.log(`Detalhes completos: ${path.join(backupDir, "restore-notes.md")}`);
}