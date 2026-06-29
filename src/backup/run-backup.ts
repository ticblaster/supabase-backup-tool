import fs from "fs-extra";
import path from "node:path";
import {
  loadConfig,
  resolveBackupRoot,
  resolveProject,
  type BackupConfig,
} from "../config.js";
import { runChecks } from "../checks.js";
import { initBackupLogger } from "../logger.js";
import { backupDatabase, resolveSupabaseCli } from "./backup-db.js";
import { backupStorage } from "./backup-storage.js";
import { writeManifest, type BackupType } from "./manifest.js";
import { printRestoreGuide as printRestoreGuideToConsole, writeRestoreNotes } from "./restore-notes.js";
import { formatBackupTimestamp } from "../utils/timestamp.js";
import { ensureDir } from "../utils/ensure-dir.js";

export interface RunBackupOptions {
  projectName?: string;
  type: BackupType;
  configPath?: string;
}

export async function runBackup(options: RunBackupOptions): Promise<string> {
  const config = await loadConfig(options.configPath);
  const { name, project } = resolveProject(config, options.projectName);

  const check = await runChecks(name);
  if (!check.ok) {
    throw new Error(
      `Pré-validação falhou. Execute npm run check -- --project ${name}\n${check.errors.join("\n")}`,
    );
  }

  const backupRoot = resolveBackupRoot(config);
  const timestamp = formatBackupTimestamp();
  const backupDir = path.join(backupRoot, name, timestamp);
  await ensureDir(backupDir);

  const logger = await initBackupLogger(backupDir);

  try {
    let dbFiles: { roles: string; schema: string; data: string } | undefined;
    let dbWarnings: string[] | undefined;
    let databaseInfo = undefined;
    let storageResult = null;

    if (options.type === "full" || options.type === "db-only") {
      const dbResult = await backupDatabase(project, backupDir, logger, {
        supabaseCli: resolveSupabaseCli(config),
      });
      dbFiles = dbResult.files;
      dbWarnings = dbResult.warnings;
      databaseInfo = {
        engine: dbResult.database.engine,
        selectedDbUrlEnv: dbResult.database.selectedDbUrlEnv,
        selectedDbUrlMasked: dbResult.database.selectedDbUrlMasked,
        candidateDbUrlEnvs: dbResult.database.candidateDbUrlEnvs,
      };
    }

    if (options.type === "full" || options.type === "storage-only") {
      storageResult = await backupStorage(project, backupDir, logger);
    }

    logger.info("manifest", "Gerando manifest.json...");
    const manifest = await writeManifest(backupDir, {
      projectName: name,
      projectRef: project.projectRef,
      backupType: options.type,
      dbFiles,
      dbWarnings,
      database: databaseInfo,
      storage: storageResult,
    });

    logger.info("manifest", "Gerando restore-notes.md...");
    await writeRestoreNotes(backupDir, manifest);

    logger.info("done", `Backup completo em ${path.relative(process.cwd(), backupDir)}`);
    return backupDir;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("error", message);
    logger.error("error", `Log completo: ${path.join(backupDir, "logs", "backup.log")}`);
    throw error;
  }
}

export async function listProjects(configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const defaultName = config.defaultProject;

  console.log("Projetos configurados:\n");
  for (const [name, project] of Object.entries(config.projects)) {
    const marker = name === defaultName ? " (default)" : "";
    const storage = project.storage
      ? `${project.storage.mode} [${project.storage.buckets.join(", ")}]`
      : "sem storage";
    console.log(`- ${name}${marker}`);
    console.log(`  ref: ${project.projectRef}`);
    const dbEnvLabel = project.dbUrlEnvCandidates?.length
      ? project.dbUrlEnvCandidates.join(", ")
      : (project.dbUrlEnv ?? "(não configurado)");
    console.log(`  db:  ${dbEnvLabel}`);
    console.log(`  storage: ${storage}`);
    console.log("");
  }
}

export async function printRestoreGuide(
  projectName: string | undefined,
  backupId: string,
  configPath?: string,
): Promise<void> {
  const config = await loadConfig(configPath);
  const { name } = resolveProject(config, projectName);
  const backupRoot = resolveBackupRoot(config);
  const backupDir = path.join(backupRoot, name, backupId);

  if (!(await fs.pathExists(backupDir))) {
    throw new Error(`Backup não encontrado: ${backupDir}`);
  }

  const manifestPath = path.join(backupDir, "manifest.json");
  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(`manifest.json não encontrado em ${backupDir}`);
  }

  const manifest = await fs.readJson(manifestPath);
  printRestoreGuideToConsole(backupDir, manifest);
}