import fs from "fs-extra";
import path from "node:path";
import type { ProjectConfig, ProjectStorageConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { runCommand } from "../shell.js";
import { ensureDir } from "../utils/ensure-dir.js";

export type BucketBackupStatus = "completed" | "skipped" | "failed";

export interface BucketBackupResult {
  name: string;
  status: BucketBackupStatus;
  path: string;
  message?: string;
}

export interface StorageBackupResult {
  mode: ProjectStorageConfig["mode"];
  buckets: BucketBackupResult[];
  warnings: string[];
}

export async function backupStorage(
  project: ProjectConfig,
  backupDir: string,
  logger: Logger,
): Promise<StorageBackupResult | null> {
  const storage = project.storage;
  if (!storage || storage.buckets.length === 0) {
    logger.info("storage", "Nenhum bucket configurado — etapa ignorada");
    return null;
  }

  const storageRoot = path.join(backupDir, "storage");
  await ensureDir(storageRoot);

  const warnings = [
    "Database dump does not include physical Storage files.",
    "Buckets must be copied separately from the database backup.",
  ];

  logger.info(
    "storage",
    `Modo ${storage.mode} — buckets: ${storage.buckets.join(", ")}`,
  );

  if (storage.mode === "rclone") {
    return backupStorageRclone(storage, storageRoot, logger, warnings);
  }

  return backupStorageSupabaseCli(storage, storageRoot, logger, warnings);
}

async function backupStorageRclone(
  storage: ProjectStorageConfig,
  storageRoot: string,
  logger: Logger,
  warnings: string[],
): Promise<StorageBackupResult> {
  if (!storage.remote) {
    throw new Error("storage.remote é obrigatório no modo rclone");
  }

  const results: BucketBackupResult[] = [];

  for (const bucket of storage.buckets) {
    const dest = path.join(storageRoot, bucket);
    await ensureDir(dest);

    logger.info("storage", `Copiando bucket ${bucket}...`);

    try {
      await runCommand(
        "rclone",
        [
          "copy",
          `${storage.remote}:${bucket}`,
          dest,
          "--progress",
          "--stats-one-line",
          ...(storage.rcloneFlags ?? []),
        ],
        { logger, tag: "storage" },
      );

      results.push({
        name: bucket,
        status: "completed",
        path: path.join("storage", bucket),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: bucket,
        status: "failed",
        path: path.join("storage", bucket),
        message,
      });
      throw new Error(`Falha ao copiar bucket ${bucket}: ${message}`);
    }
  }

  return { mode: "rclone", buckets: results, warnings };
}

async function backupStorageSupabaseCli(
  storage: ProjectStorageConfig,
  storageRoot: string,
  logger: Logger,
  warnings: string[],
): Promise<StorageBackupResult> {
  warnings.push(
    "supabase-cli mode: download recursivo de buckets pode não estar disponível na sua versão da CLI.",
    "Recomenda-se configurar storage.mode=rclone para backup confiável dos arquivos.",
  );

  const results: BucketBackupResult[] = [];

  for (const bucket of storage.buckets) {
    const dest = path.join(storageRoot, bucket);
    await ensureDir(dest);

    logger.info("storage", `Tentando baixar bucket ${bucket} via Supabase CLI...`);

    try {
      await runCommand(
        "supabase",
        ["storage", "cp", "-r", `ss:///${bucket}`, dest],
        { logger, tag: "storage" },
      );

      results.push({
        name: bucket,
        status: "completed",
        path: path.join("storage", bucket),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        "storage",
        `Falha no bucket ${bucket}. Considere usar rclone. Motivo: ${message}`,
      );
      results.push({
        name: bucket,
        status: "failed",
        path: path.join("storage", bucket),
        message,
      });
      throw new Error(
        `Backup do bucket ${bucket} via supabase-cli falhou. Configure rclone para backup confiável.\n${message}`,
      );
    }
  }

  return { mode: "supabase-cli", buckets: results, warnings };
}