import type { ProjectConfig } from "./config.js";
import { getDbEngine, resolveDbUrlEnvNames } from "./config.js";
import type { Logger } from "./logger.js";
import { runCommandSoft } from "./shell.js";
import { maskConnectionString } from "./utils/mask-secret.js";

export type ConnectionFailureKind = "auth" | "connection" | "unknown";

export interface DbConnectionTestResult {
  ok: boolean;
  combined: string;
  exitCode: number;
}

export type DbConnectionTester = (dbUrl: string) => Promise<DbConnectionTestResult>;

export interface SelectedDbUrl {
  url: string;
  selectedDbUrlEnv: string;
  selectedDbUrlMasked: string;
  candidateDbUrlEnvs: string[];
  engine: ReturnType<typeof getDbEngine>;
}

export interface DbUrlEnvAudit {
  candidateDbUrlEnvs: string[];
  configured: Array<{ envName: string; masked: string }>;
  missing: string[];
}

export { resolveDbUrlEnvNames } from "./config.js";

export function auditProjectDbUrlEnvs(project: ProjectConfig): DbUrlEnvAudit {
  const candidateDbUrlEnvs = resolveDbUrlEnvNames(project);
  const configured: DbUrlEnvAudit["configured"] = [];
  const missing: string[] = [];

  for (const envName of candidateDbUrlEnvs) {
    const value = process.env[envName]?.trim();
    if (!value) {
      missing.push(envName);
      continue;
    }
    configured.push({
      envName,
      masked: maskConnectionString(value),
    });
  }

  return { candidateDbUrlEnvs, configured, missing };
}

export function classifyConnectionFailure(output: string): ConnectionFailureKind {
  const text = output.toLowerCase();

  const authPatterns = [
    "password authentication failed",
    "authentication failed",
    "fatal:  password",
    "fatal: password",
    "28p01",
    "invalid authorization specification",
    "no pg_hba.conf entry",
  ];

  if (authPatterns.some((pattern) => text.includes(pattern))) {
    return "auth";
  }

  const connectionPatterns = [
    "could not translate host name",
    "could not connect to server",
    "connection refused",
    "connection timed out",
    "timeout expired",
    "network is unreachable",
    "no route to host",
    "enetunreach",
    "eai_again",
    "etimedout",
    "name or service not known",
    "temporary failure in name resolution",
    "could not resolve host",
    "server closed the connection unexpectedly",
  ];

  if (connectionPatterns.some((pattern) => text.includes(pattern))) {
    return "connection";
  }

  return "unknown";
}

export async function defaultPsqlConnectionTester(
  dbUrl: string,
): Promise<DbConnectionTestResult> {
  const result = await runCommandSoft("psql", [
    "--dbname",
    dbUrl,
    "--command",
    "select 1;",
    "--quiet",
    "--tuples-only",
  ]);

  return {
    ok: result.exitCode === 0,
    combined: result.combined,
    exitCode: result.exitCode,
  };
}

export async function selectWorkingDbUrl(
  project: ProjectConfig,
  logger: Logger,
  tester: DbConnectionTester = defaultPsqlConnectionTester,
): Promise<SelectedDbUrl> {
  const candidateDbUrlEnvs = resolveDbUrlEnvNames(project);
  const configuredCandidates: Array<{ envName: string; url: string }> = [];

  for (const envName of candidateDbUrlEnvs) {
    const url = process.env[envName]?.trim();
    if (!url) {
      logger.info("db", `Variável ausente, ignorando candidata: ${envName}`);
      continue;
    }
    configuredCandidates.push({ envName, url });
  }

  if (configuredCandidates.length === 0) {
    throw new Error(
      `Nenhuma URL de banco configurada. Defina ${candidateDbUrlEnvs.join(" ou ")} no .env.`,
    );
  }

  const failures: string[] = [];

  for (let index = 0; index < configuredCandidates.length; index += 1) {
    const { envName, url } = configuredCandidates[index];
    const masked = maskConnectionString(url);

    logger.info("db", `Testando conexão: ${envName} (${masked})`);

    const result = await tester(url);
    if (result.ok) {
      logger.info("db", `Conexão OK: ${envName}`);
      logger.info("db", `Usando URL de banco: ${envName}`);
      return {
        url,
        selectedDbUrlEnv: envName,
        selectedDbUrlMasked: masked,
        candidateDbUrlEnvs,
        engine: getDbEngine(project),
      };
    }

    const failureKind = classifyConnectionFailure(result.combined);
    const reason = summarizeFailure(result.combined);

    if (failureKind === "auth") {
      throw new Error(
        `Falha de autenticação em ${envName}: ${reason}. Verifique a senha/credencial — fallback não será tentado.`,
      );
    }

    logger.info("db", `Falha de conexão em ${envName}: ${reason}`);
    failures.push(`${envName}: ${reason}`);

    if (index < configuredCandidates.length - 1) {
      logger.info("db", "Tentando próxima URL candidata...");
    }
  }

  throw new Error(
    `Nenhuma URL candidata funcionou.\n${failures.join("\n")}`,
  );
}

function summarizeFailure(output: string): string {
  const line = output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(Boolean);

  return line ? line.slice(0, 300) : "conexão falhou";
}