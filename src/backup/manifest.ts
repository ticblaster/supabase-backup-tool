import fs from "fs-extra";
import path from "node:path";
import type { DbBackupEngine } from "../config.js";
import type { StorageBackupResult } from "./backup-storage.js";
import { getFileSizeBytes, hashFileSha256 } from "../utils/hash-file.js";

export type BackupType = "full" | "db-only" | "storage-only";

export interface ManifestFileEntry {
  path: string;
  sizeBytes: number;
  sha256: string;
}

export interface ManifestDatabase {
  engine: DbBackupEngine;
  selectedDbUrlEnv: string;
  selectedDbUrlMasked: string;
  candidateDbUrlEnvs: string[];
}

export interface Manifest {
  tool: "supabase-backup-tool";
  version: string;
  createdAt: string;
  projectName: string;
  projectRef: string;
  backupType: BackupType;
  database?: ManifestDatabase;
  paths: {
    roles?: string;
    schema?: string;
    data?: string;
    storage?: string;
  };
  files: ManifestFileEntry[];
  storage?: StorageBackupResult;
  warnings: string[];
}

const TOOL_VERSION = "0.1.0";

const DEFAULT_WARNINGS = [
  "Supabase Auth, Storage metadata and managed schemas may require special validation during restore.",
  "Database dump does not include physical Storage files.",
];

export async function writeManifest(
  backupDir: string,
  input: {
    projectName: string;
    projectRef: string;
    backupType: BackupType;
    dbFiles?: { roles: string; schema: string; data: string };
    dbWarnings?: string[];
    database?: ManifestDatabase;
    storage?: StorageBackupResult | null;
  },
): Promise<Manifest> {
  const files: ManifestFileEntry[] = [];

  if (input.dbFiles) {
    for (const relPath of Object.values(input.dbFiles)) {
      const absPath = path.join(backupDir, relPath);
      if (await fs.pathExists(absPath)) {
        files.push({
          path: relPath.replace(/\\/g, "/"),
          sizeBytes: await getFileSizeBytes(absPath),
          sha256: await hashFileSha256(absPath),
        });
      }
    }
  }

  const warnings = [...DEFAULT_WARNINGS];
  if (input.dbWarnings?.length) {
    warnings.push(...input.dbWarnings);
  }
  if (input.storage?.warnings.length) {
    warnings.push(...input.storage.warnings);
  }

  const manifest: Manifest = {
    tool: "supabase-backup-tool",
    version: TOOL_VERSION,
    createdAt: new Date().toISOString(),
    projectName: input.projectName,
    projectRef: input.projectRef,
    backupType: input.backupType,
    database: input.database,
    paths: {
      roles: input.dbFiles?.roles,
      schema: input.dbFiles?.schema,
      data: input.dbFiles?.data,
      storage: input.storage ? "storage/" : undefined,
    },
    files,
    storage: input.storage ?? undefined,
    warnings: [...new Set(warnings)],
  };

  const manifestPath = path.join(backupDir, "manifest.json");
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  return manifest;
}