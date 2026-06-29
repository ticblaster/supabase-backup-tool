import { execa } from "execa";
import type { Logger } from "./logger.js";
import { maskConnectionString } from "./utils/mask-secret.js";

export interface CommandResult {
  stdout: string;
  stderr: string;
  combined: string;
  exitCode: number;
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    if (process.platform === "win32") {
      const result = await execa("where", [command], { reject: false });
      return result.exitCode === 0;
    }
    const result = await execa("which", [command], { reject: false });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function runCommand(
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    logger?: Logger;
    tag?: string;
  } = {},
): Promise<CommandResult> {
  const { env, cwd, logger, tag = "shell" } = options;
  const printable = [command, ...args.map((arg) => sanitizeArg(arg))].join(" ");
  logger?.debug(tag, `Executando: ${printable}`);

  const result = await execa(command, args, {
    env,
    cwd,
    reject: false,
    all: true,
  });

  const combined = result.all ?? `${result.stdout}\n${result.stderr}`.trim();

  if (result.exitCode !== 0) {
    logger?.error(tag, `Comando falhou (${result.exitCode}): ${printable}`);
    if (combined) {
      logger?.error(tag, sanitizeOutput(combined));
    }
    throw new Error(
      `Comando falhou: ${printable}\n${sanitizeOutput(combined)}`,
    );
  }

  if (combined) {
    logger?.debug(tag, sanitizeOutput(combined));
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    combined,
    exitCode: result.exitCode ?? 0,
  };
}

export async function runCommandSoft(
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    logger?: Logger;
    tag?: string;
  } = {},
): Promise<CommandResult> {
  const { env, cwd, logger, tag = "shell" } = options;
  const printable = [command, ...args.map((arg) => sanitizeArg(arg))].join(" ");
  logger?.debug(tag, `Executando: ${printable}`);

  const result = await execa(command, args, {
    env,
    cwd,
    reject: false,
    all: true,
  });

  const combined = result.all ?? `${result.stdout}\n${result.stderr}`.trim();

  if (combined) {
    logger?.debug(tag, sanitizeOutput(combined));
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    combined,
    exitCode: result.exitCode ?? 0,
  };
}

function sanitizeArg(arg: string): string {
  if (arg.startsWith("postgresql://") || arg.startsWith("postgres://")) {
    return maskConnectionString(arg);
  }
  return arg;
}

function sanitizeOutput(output: string): string {
  return output.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, (match) =>
    maskConnectionString(match),
  );
}