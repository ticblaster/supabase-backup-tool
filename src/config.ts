import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type StorageMode = "rclone" | "supabase-cli";
export type DbBackupEngine = "supabase-cli" | "pgdump";

export const DEFAULT_DB_ENGINE: DbBackupEngine = "pgdump";

export interface ProjectDbConfig {
  engine?: DbBackupEngine;
  excludeTables?: string[];
}

export interface ProjectStorageConfig {
  mode: StorageMode;
  remote?: string;
  buckets: string[];
  rcloneFlags?: string[];
}

export interface ProjectConfig {
  projectRef: string;
  dbUrlEnv?: string;
  dbUrlEnvCandidates?: string[];
  db?: ProjectDbConfig;
  storage?: ProjectStorageConfig;
}

export interface BackupConfig {
  supabaseCli?: string;
  defaultProject?: string;
  backupRoot: string;
  projects: Record<string, ProjectConfig>;
}

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function getRootDir(): string {
  return ROOT_DIR;
}

export function resolveConfigPath(customPath?: string): string {
  return path.resolve(ROOT_DIR, customPath ?? "backup.config.json");
}

export async function loadConfig(configPath?: string): Promise<BackupConfig> {
  const resolved = resolveConfigPath(configPath);

  if (!(await fs.pathExists(resolved))) {
    const example = resolveConfigPath("backup.config.example.json");
    throw new Error(
      `Arquivo de configuração não encontrado: ${resolved}\n` +
        `Copie ${example} para backup.config.json e ajuste os projetos.`,
    );
  }

  const raw = await fs.readJson(resolved);
  return validateConfig(raw, resolved);
}

function validateConfig(raw: unknown, configPath: string): BackupConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Configuração inválida em ${configPath}`);
  }

  const config = raw as Partial<BackupConfig>;

  if (!config.backupRoot || typeof config.backupRoot !== "string") {
    throw new Error(`backupRoot é obrigatório em ${configPath}`);
  }

  if (!config.projects || typeof config.projects !== "object") {
    throw new Error(`projects é obrigatório em ${configPath}`);
  }

  for (const [name, project] of Object.entries(config.projects)) {
    if (!project.projectRef) {
      throw new Error(`projectRef ausente para o projeto "${name}"`);
    }
    validateProjectDbUrlConfig(project, name);
    if (
      project.db?.engine &&
      !["pgdump", "supabase-cli"].includes(project.db.engine)
    ) {
      throw new Error(`db.engine inválido para "${name}"`);
    }
    if (project.storage) {
      if (!["rclone", "supabase-cli"].includes(project.storage.mode)) {
        throw new Error(`storage.mode inválido para "${name}"`);
      }
      if (!Array.isArray(project.storage.buckets)) {
        throw new Error(`storage.buckets deve ser array para "${name}"`);
      }
      if (project.storage.mode === "rclone" && !project.storage.remote) {
        throw new Error(`storage.remote é obrigatório no modo rclone para "${name}"`);
      }
    }
  }

  return config as BackupConfig;
}

export function resolveProject(
  config: BackupConfig,
  projectName?: string,
): { name: string; project: ProjectConfig } {
  const name = projectName ?? config.defaultProject;

  if (!name) {
    throw new Error(
      "Projeto não informado. Use --project <nome> ou defina defaultProject no config.",
    );
  }

  const project = config.projects[name];
  if (!project) {
    const available = Object.keys(config.projects).join(", ");
    throw new Error(`Projeto "${name}" não encontrado. Disponíveis: ${available}`);
  }

  return { name, project };
}

export function resolveBackupRoot(config: BackupConfig): string {
  return path.isAbsolute(config.backupRoot)
    ? config.backupRoot
    : path.resolve(ROOT_DIR, config.backupRoot);
}

export function getDbEngine(project: ProjectConfig): DbBackupEngine {
  return project.db?.engine ?? DEFAULT_DB_ENGINE;
}

export function resolveDbUrlEnvNames(project: ProjectConfig): string[] {
  if (project.dbUrlEnvCandidates?.length) {
    return project.dbUrlEnvCandidates;
  }
  if (project.dbUrlEnv) {
    return [project.dbUrlEnv];
  }
  return [];
}

export function validateProjectDbUrlConfig(
  project: Pick<ProjectConfig, "dbUrlEnv" | "dbUrlEnvCandidates">,
  projectName: string,
): void {
  if (project.dbUrlEnvCandidates !== undefined) {
    if (
      !Array.isArray(project.dbUrlEnvCandidates) ||
      project.dbUrlEnvCandidates.length === 0
    ) {
      throw new Error(
        `dbUrlEnvCandidates deve ser array não vazio para "${projectName}"`,
      );
    }
    return;
  }

  if (!project.dbUrlEnv) {
    throw new Error(
      `nenhuma URL de banco configurada para o projeto "${projectName}". Configure dbUrlEnvCandidates ou dbUrlEnv.`,
    );
  }
}

export function getDbUrl(project: ProjectConfig): string {
  const candidates = resolveDbUrlEnvNames(project);

  if (candidates.length === 0) {
    throw new Error(
      "Nenhuma URL de banco configurada. Configure dbUrlEnvCandidates ou dbUrlEnv.",
    );
  }

  for (const envName of candidates) {
    const value = process.env[envName]?.trim();
    if (value) {
      return value;
    }
  }

  throw new Error(
    `Nenhuma variável de ambiente de banco definida. Configure ${candidates.join(" ou ")} no .env.`,
  );
}