import fs from "fs-extra";
import path from "node:path";
import type { ProjectConfig } from "../config.js";
import { getDbEngine, type BackupConfig } from "../config.js";
import { selectWorkingDbUrl, type SelectedDbUrl } from "../db-url-selector.js";
import type { Logger } from "../logger.js";
import { commandExists, runCommand } from "../shell.js";
import {
  buildDbDumpSteps,
  validateDbDumpSteps,
  type DbDumpStep,
} from "./build-db-dump-args.js";
import { buildRolesPlaceholder } from "./pgdump-roles.js";
import {
  CIRCULAR_FK_MANIFEST_WARNING,
  detectCircularForeignKeys,
} from "./pgdump-warnings.js";
import { ensureDir } from "../utils/ensure-dir.js";

export interface DbBackupResult {
  dbDir: string;
  files: {
    roles: string;
    schema: string;
    data: string;
  };
  warnings: string[];
  database: SelectedDbUrl;
}

export interface BackupDatabaseOptions {
  supabaseCli?: string;
}

export async function backupDatabase(
  project: ProjectConfig,
  backupDir: string,
  logger: Logger,
  options: BackupDatabaseOptions = {},
): Promise<DbBackupResult> {
  const dbDir = path.join(backupDir, "db");
  await ensureDir(dbDir);

  const selection = await selectWorkingDbUrl(project, logger);
  const dbUrl = selection.url;
  const engine = getDbEngine(project);
  const supabaseCli = options.supabaseCli ?? "npx supabase";

  logger.info("db", `Iniciando backup do banco (${selection.selectedDbUrlMasked})`);
  logger.info("db", `Engine: ${engine}`);

  const steps = buildDbDumpSteps(
    engine,
    dbUrl,
    dbDir,
    project.db?.excludeTables,
    supabaseCli,
  ).map((step) => ({
    ...step,
    file: path.join(dbDir, step.label),
  }));

  validateDbDumpSteps(engine, steps);
  assertSingleDbUrlInSteps(steps, dbUrl);

  const warnings: string[] = [];
  let circularForeignKeys = false;

  for (const step of steps) {
    if (engine === "pgdump" && step.kind === "roles") {
      await backupRolesWithPgdump(step, logger);
      continue;
    }

    const stepDetected = await executeDumpStep(step, logger);
    if (stepDetected.circularForeignKeys) {
      circularForeignKeys = true;
    }
  }

  if (circularForeignKeys) {
    warnings.push(CIRCULAR_FK_MANIFEST_WARNING);
    logger.info(
      "db",
      "Aviso: foreign keys circulares detectadas no dump de dados",
    );
  }

  logger.info("db", "Backup do banco concluído");

  return {
    dbDir,
    files: {
      roles: path.join("db", "roles.sql"),
      schema: path.join("db", "schema.sql"),
      data: path.join("db", "data.sql"),
    },
    warnings,
    database: selection,
  };
}

export function resolveSupabaseCli(config: BackupConfig): string {
  return config.supabaseCli?.trim() || "npx supabase";
}

function assertSingleDbUrlInSteps(
  steps: Array<DbDumpStep & { file: string }>,
  dbUrl: string,
): void {
  for (const step of steps) {
    const dbNameIndex = step.args.indexOf("--dbname");
    const dbUrlIndex = step.args.indexOf("--db-url");
    const urlArgIndex =
      dbNameIndex >= 0 ? dbNameIndex + 1 : dbUrlIndex >= 0 ? dbUrlIndex + 1 : -1;

    if (urlArgIndex >= 0 && step.args[urlArgIndex] !== dbUrl) {
      throw new Error(
        `Inconsistência de URL no passo ${step.label}: todos os dumps devem usar a mesma URL selecionada.`,
      );
    }
  }
}

async function backupRolesWithPgdump(
  step: DbDumpStep & { file: string },
  logger: Logger,
): Promise<void> {
  logger.info("db", "Gerando roles.sql...");

  const pgDumpallAvailable = await commandExists("pg_dumpall");
  if (!pgDumpallAvailable) {
    await writeRolesPlaceholderFile(
      step.file,
      "pg_dumpall indisponível ou permissão insuficiente",
    );
    logger.info(
      "db",
      "roles.sql: pg_dumpall indisponível — arquivo de aviso gerado",
    );
    return;
  }

  try {
    await runCommand(step.executable, step.args, { logger, tag: "db" });
    if (!(await fs.pathExists(step.file))) {
      throw new Error("pg_dumpall não gerou roles.sql");
    }
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "pg_dumpall falhou";
    await writeRolesPlaceholderFile(
      step.file,
      "pg_dumpall indisponível ou permissão insuficiente",
    );
    logger.info(
      "db",
      `roles.sql: falha no pg_dumpall — arquivo de aviso gerado (${reason})`,
    );
  }
}

async function writeRolesPlaceholderFile(
  filePath: string,
  reason: string,
): Promise<void> {
  await fs.writeFile(filePath, buildRolesPlaceholder(reason), "utf8");
}

interface DumpStepResult {
  circularForeignKeys: boolean;
}

async function executeDumpStep(
  step: DbDumpStep & { file: string },
  logger: Logger,
): Promise<DumpStepResult> {
  logger.info("db", `Gerando ${step.label}...`);
  const result = await runCommand(step.executable, step.args, {
    logger,
    tag: "db",
  });

  if (!(await fs.pathExists(step.file))) {
    throw new Error(`Arquivo esperado não foi gerado: ${step.file}`);
  }

  return {
    circularForeignKeys: detectCircularForeignKeys(result.combined),
  };
}