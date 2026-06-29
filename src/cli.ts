import { Command } from "commander";
import dotenv from "dotenv";
import path from "node:path";
import { getRootDir } from "./config.js";
import { runChecks } from "./checks.js";
import {
  listProjects,
  printRestoreGuide,
  runBackup,
} from "./backup/run-backup.js";

function loadEnv(): void {
  dotenv.config({ path: path.join(getRootDir(), ".env") });
}

function projectOption(cmd: Command): Command {
  return cmd.option("-p, --project <name>", "Nome do projeto no backup.config.json");
}

export function buildCli(): Command {
  const program = new Command();

  program
    .name("supabase-backup-tool")
    .description("Backup lógico local de bancos Supabase e buckets de Storage")
    .version("0.1.0")
    .hook("preAction", () => {
      loadEnv();
    });

  projectOption(
    program
      .command("backup")
      .description("Backup completo: banco + storage")
      .action(async (opts: { project?: string }) => {
        await runBackup({ projectName: opts.project, type: "full" });
      }),
  );

  projectOption(
    program
      .command("backup-db")
      .description("Backup apenas do banco (roles, schema, data)")
      .action(async (opts: { project?: string }) => {
        await runBackup({ projectName: opts.project, type: "db-only" });
      }),
  );

  projectOption(
    program
      .command("backup-storage")
      .description("Backup apenas dos buckets de Storage")
      .action(async (opts: { project?: string }) => {
        await runBackup({ projectName: opts.project, type: "storage-only" });
      }),
  );

  program
    .command("list-projects")
    .description("Lista projetos configurados")
    .action(async () => {
      await listProjects();
    });

  projectOption(
    program
      .command("check")
      .description("Verifica dependências externas, config e variáveis de ambiente")
      .option(
        "--test-db-connection",
        "Testa conexão com psql nas URLs candidatas do projeto",
      )
      .action(async (opts: { project?: string; testDbConnection?: boolean }) => {
        const report = await runChecks(opts.project, {
          testDbConnection: opts.testDbConnection,
        });
        if (!report.ok) {
          process.exitCode = 1;
        }
      }),
  );

  projectOption(
    program
      .command("restore-print")
      .description("Imprime roteiro seguro de restauração (não executa restore)")
      .requiredOption("-b, --backup <id>", "ID do backup (ex.: 20260629-151045)")
      .action(async (opts: { project?: string; backup: string }) => {
        await printRestoreGuide(opts.project, opts.backup);
      }),
  );

  return program;
}