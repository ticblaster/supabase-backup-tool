import fs from "fs-extra";
import path from "node:path";
import {
  DEFAULT_DB_ENGINE,
  getDbEngine,
  loadConfig,
  resolveConfigPath,
  resolveProject,
  type BackupConfig,
  type DbBackupEngine,
  type ProjectConfig,
} from "./config.js";
import {
  auditProjectDbUrlEnvs,
  selectWorkingDbUrl,
} from "./db-url-selector.js";

import { Logger } from "./logger.js";
import { commandExists } from "./shell.js";
import { parseCliCommand } from "./utils/parse-cli-command.js";

export interface DependencyCheck {
  name: string;
  required: boolean;
  found: boolean;
  installHint: string;
}

export interface CheckReport {
  ok: boolean;
  dependencies: DependencyCheck[];
  configPath: string;
  configValid: boolean;
  projects: Array<{
    name: string;
    dbUrlEnv?: string;
    candidateDbUrlEnvs: string[];
    dbEngine: DbBackupEngine;
    dbUrlConfigured: boolean;
    selectedDbUrlEnv?: string;
    dbUrlMasked?: string;
    storageMode?: string;
  }>;
  errors: string[];
}

export interface RunChecksOptions {
  testDbConnection?: boolean;
  dbUrlSelector?: typeof selectWorkingDbUrl;
  dbUrlOnly?: boolean;
}

interface ProjectRequirements {
  needsPgdump: boolean;
  needsPgDumpall: boolean;
  needsSupabaseCli: boolean;
  needsRclone: boolean;
  needsPsql: boolean;
}

function collectRequirements(
  config: BackupConfig,
  options: RunChecksOptions,
): ProjectRequirements {
  const projects = Object.values(config.projects);

  return {
    needsPgdump: projects.some((p) => getDbEngine(p) === "pgdump"),
    needsPgDumpall: projects.some((p) => getDbEngine(p) === "pgdump"),
    needsSupabaseCli: projects.some(
      (p) =>
        getDbEngine(p) === "supabase-cli" || p.storage?.mode === "supabase-cli",
    ),
    needsRclone: projects.some((p) => p.storage?.mode === "rclone"),
    needsPsql: Boolean(options.testDbConnection),
  };
}

async function supabaseCliExists(config?: BackupConfig): Promise<boolean> {
  if (await commandExists("supabase")) {
    return true;
  }

  const cli = config?.supabaseCli?.trim() || "npx supabase";
  const { executable } = parseCliCommand(cli);

  if (executable === "npx") {
    return commandExists("npx");
  }

  return commandExists(executable);
}

export async function checkDependencies(
  config?: BackupConfig,
  options: RunChecksOptions = {},
): Promise<DependencyCheck[]> {
  const requirements = config
    ? collectRequirements(config, options)
    : {
        needsPgdump: true,
        needsPgDumpall: true,
        needsSupabaseCli: false,
        needsRclone: false,
        needsPsql: Boolean(options.testDbConnection),
      };

  const checks: DependencyCheck[] = [];

  if (requirements.needsPgdump) {
    checks.push({
      name: "pg_dump",
      required: true,
      found: await commandExists("pg_dump"),
      installHint:
        "Obrigatório para db.engine=pgdump. Instale PostgreSQL client tools.",
    });
    checks.push({
      name: "pg_dumpall",
      required: false,
      found: await commandExists("pg_dumpall"),
      installHint:
        "Recomendado para roles.sql no engine pgdump. Sem ele, roles.sql vira arquivo de aviso.",
    });
  }

  if (requirements.needsSupabaseCli) {
    checks.push({
      name: "supabase-cli",
      required: true,
      found: await supabaseCliExists(config),
      installHint:
        "Obrigatório para db.engine=supabase-cli ou storage.mode=supabase-cli. Pode exigir Docker Desktop.",
    });
  }

  checks.push({
    name: "psql",
    required: requirements.needsPsql,
    found: await commandExists("psql"),
    installHint: requirements.needsPsql
      ? "Obrigatório para --test-db-connection."
      : "Recomendado para validação/restauração manual com psql.",
  });

  if (requirements.needsRclone) {
    checks.push({
      name: "rclone",
      required: true,
      found: await commandExists("rclone"),
      installHint: "Instale rclone: https://rclone.org/install/",
    });
  }

  return checks;
}

export async function runChecks(
  projectName?: string,
  options: RunChecksOptions = {},
): Promise<CheckReport> {
  const logger = new Logger();
  const errors: string[] = [];
  const configPath = resolveConfigPath();

  let config: BackupConfig | null = null;
  let configValid = false;

  try {
    config = await loadConfig();
    configValid = true;
    logger.info("check", `Configuração encontrada: ${configPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    logger.error("check", message);
  }

  const dependencies = await checkDependencies(config ?? undefined, options);

  for (const dep of dependencies) {
    if (dep.found) {
      logger.info("check", `${dep.name} encontrado`);
    } else if (dep.required) {
      const msg = `${dep.name} não encontrado. ${dep.installHint}`;
      errors.push(msg);
      logger.error("check", msg);
    } else {
      logger.info("check", `${dep.name} não encontrado (opcional/recomendado)`);
    }
  }

  const projects: CheckReport["projects"] = [];

  if (config) {
    const projectEntries = projectName
      ? [resolveProject(config, projectName)]
      : Object.entries(config.projects).map(([name, project]) => ({ name, project }));

    for (const { name, project } of projectEntries) {
      const entry = await checkProjectEnv(
        name,
        project,
        config,
        errors,
        logger,
        options,
      );
      projects.push(entry);
    }
  }

  if (!(await fs.pathExists(path.resolve(path.dirname(configPath), ".env")))) {
    logger.info(
      "check",
      ".env não encontrado na raiz — use variáveis de ambiente do sistema ou crie .env",
    );
  }

  const requiredMissing = dependencies.some((d) => d.required && !d.found);

  return {
    ok: errors.length === 0 && configValid && !requiredMissing,
    dependencies,
    configPath,
    configValid,
    projects,
    errors,
  };
}

async function checkProjectEnv(
  name: string,
  project: ProjectConfig,
  config: BackupConfig,
  errors: string[],
  logger: Logger,
  options: RunChecksOptions,
): Promise<CheckReport["projects"][number]> {
  const dbEngine = getDbEngine(project);
  const audit = auditProjectDbUrlEnvs(project);

  logger.info("check", `${name}: db.engine=${dbEngine}`);
  logger.info(
    "check",
    `${name}: candidatas=${audit.candidateDbUrlEnvs.join(", ")}`,
  );

  for (const missing of audit.missing) {
    logger.info("check", `${name}: variável ausente (warning): ${missing}`);
  }

  let dbUrlConfigured = audit.configured.length > 0;
  let dbUrlMasked = audit.configured[0]?.masked;
  let selectedDbUrlEnv = audit.configured[0]?.envName;

  if (!dbUrlConfigured) {
    const msg = `${name}: nenhuma URL de banco configurada no ambiente (${audit.candidateDbUrlEnvs.join(", ")})`;
    errors.push(msg);
    logger.error("check", msg);
  } else {
    logger.info(
      "check",
      `${name}: ${audit.configured.length} URL(s) configurada(s)`,
    );
    for (const entry of audit.configured) {
      logger.info("check", `${name}: ${entry.envName} (${entry.masked})`);
    }
  }

  if (options.testDbConnection && dbUrlConfigured) {
    try {
      const selector = options.dbUrlSelector ?? selectWorkingDbUrl;
      const selected = await selector(project, logger);
      selectedDbUrlEnv = selected.selectedDbUrlEnv;
      dbUrlMasked = selected.selectedDbUrlMasked;
      logger.info(
        "check",
        `${name}: conexão testada com sucesso via ${selected.selectedDbUrlEnv} (${selected.selectedDbUrlMasked})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${name}: ${message}`);
      logger.error("check", `${name}: ${message}`);
    }
  }

  if (!options.dbUrlOnly && dbEngine === "pgdump") {
    const pgDumpOk = await commandExists("pg_dump");
    if (!pgDumpOk) {
      const msg = `${name}: db.engine=pgdump requer pg_dump instalado`;
      errors.push(msg);
      logger.error("check", msg);
    }

    const pgDumpallOk = await commandExists("pg_dumpall");
    if (!pgDumpallOk) {
      logger.info(
        "check",
        `${name}: pg_dumpall não encontrado — roles.sql será arquivo de aviso`,
      );
    }
  }

  if (!options.dbUrlOnly && dbEngine === "supabase-cli") {
    const supabaseOk = await supabaseCliExists(config);
    if (!supabaseOk) {
      const msg = `${name}: db.engine=supabase-cli requer Supabase CLI (pode exigir Docker)`;
      errors.push(msg);
      logger.error("check", msg);
    }
  }

  if (!options.dbUrlOnly && project.storage?.mode === "rclone") {
    const rcloneOk = await commandExists("rclone");
    if (!rcloneOk) {
      const msg = `${name}: modo storage rclone requer rclone instalado`;
      errors.push(msg);
      logger.error("check", msg);
    }
  }

  if (!options.dbUrlOnly && project.storage?.mode === "supabase-cli") {
    const supabaseOk = await supabaseCliExists(config);
    if (!supabaseOk) {
      const msg = `${name}: storage.mode=supabase-cli requer Supabase CLI`;
      errors.push(msg);
      logger.error("check", msg);
    }
  }

  return {
    name,
    dbUrlEnv: project.dbUrlEnv,
    candidateDbUrlEnvs: audit.candidateDbUrlEnvs,
    dbEngine,
    dbUrlConfigured,
    selectedDbUrlEnv,
    dbUrlMasked,
    storageMode: project.storage?.mode,
  };
}

export async function runProjectDbUrlCheck(
  project: ProjectConfig,
  options: RunChecksOptions = {},
): Promise<{
  ok: boolean;
  errors: string[];
  warnings: string[];
  selectedDbUrlEnv?: string;
  candidateDbUrlEnvs: string[];
}> {
  const logger = new Logger();
  const errors: string[] = [];
  const warnings: string[] = [];
  const stubConfig = { backupRoot: "./backups", projects: {} } as BackupConfig;

  const entry = await checkProjectEnv(
    "test-project",
    project,
    stubConfig,
    errors,
    logger,
    { ...options, dbUrlOnly: true },
  );

  const audit = auditProjectDbUrlEnvs(project);
  for (const missing of audit.missing) {
    warnings.push(`variável ausente (warning): ${missing}`);
  }

  return {
    ok: errors.length === 0 && entry.dbUrlConfigured,
    errors,
    warnings,
    selectedDbUrlEnv: entry.selectedDbUrlEnv,
    candidateDbUrlEnvs: entry.candidateDbUrlEnvs,
  };
}

export { DEFAULT_DB_ENGINE };