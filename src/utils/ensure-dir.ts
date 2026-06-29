import fs from "fs-extra";

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}