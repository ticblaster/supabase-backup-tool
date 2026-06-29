import fs from "fs-extra";
import path from "node:path";
import { maskConnectionString } from "./utils/mask-secret.js";

export class Logger {
  private logFilePath: string | null = null;

  constructor(logFilePath?: string) {
    this.logFilePath = logFilePath ?? null;
  }

  setLogFile(logFilePath: string): void {
    this.logFilePath = logFilePath;
  }

  info(tag: string, message: string): void {
    this.write("info", tag, message);
  }

  error(tag: string, message: string): void {
    this.write("error", tag, message);
  }

  debug(tag: string, message: string): void {
    this.write("debug", tag, message);
  }

  private write(level: string, tag: string, message: string): void {
    const safeMessage = this.sanitize(message);
    const line = `[${level}] [${tag}] ${safeMessage}`;
    console.log(`[${tag}] ${safeMessage}`);

    if (this.logFilePath) {
      void fs.appendFile(this.logFilePath, `${line}\n`, "utf8");
    }
  }

  private sanitize(message: string): string {
    return message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, (match) =>
      maskConnectionString(match),
    );
  }
}

export async function initBackupLogger(backupDir: string): Promise<Logger> {
  const logsDir = path.join(backupDir, "logs");
  await fs.ensureDir(logsDir);
  const logFile = path.join(logsDir, "backup.log");
  await fs.writeFile(logFile, "", "utf8");
  return new Logger(logFile);
}