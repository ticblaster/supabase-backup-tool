import { parseCliCommand } from "../utils/parse-cli-command.js";

export type DbDumpKind = "roles" | "schema" | "data";
export type DbBackupEngine = "supabase-cli" | "pgdump";

export interface DbDumpStep {
  kind: DbDumpKind;
  label: string;
  executable: string;
  args: string[];
  allowFailure?: boolean;
}

function buildSupabaseExcludeArgs(excludeTables?: string[]): string[] {
  if (!excludeTables?.length) {
    return [];
  }
  return excludeTables.flatMap((table) => ["-x", table]);
}

function buildPgdumpExcludeArgs(excludeTables?: string[]): string[] {
  if (!excludeTables?.length) {
    return [];
  }
  return excludeTables.flatMap((table) => ["--exclude-table", table]);
}

export function buildSupabaseDbDumpSteps(
  dbUrl: string,
  outputDir: string,
  excludeTables: string[] | undefined,
  supabaseCli: string,
): DbDumpStep[] {
  const { executable, prefixArgs } = parseCliCommand(supabaseCli);
  const rolesFile = `${outputDir}/roles.sql`;
  const schemaFile = `${outputDir}/schema.sql`;
  const dataFile = `${outputDir}/data.sql`;
  const excludeArgs = buildSupabaseExcludeArgs(excludeTables);

  return [
    {
      kind: "roles",
      label: "roles.sql",
      executable,
      args: [
        ...prefixArgs,
        "db",
        "dump",
        "--db-url",
        dbUrl,
        "-f",
        rolesFile,
        "--role-only",
      ],
    },
    {
      kind: "schema",
      label: "schema.sql",
      executable,
      args: [
        ...prefixArgs,
        "db",
        "dump",
        "--db-url",
        dbUrl,
        "-f",
        schemaFile,
      ],
    },
    {
      kind: "data",
      label: "data.sql",
      executable,
      args: [
        ...prefixArgs,
        "db",
        "dump",
        "--db-url",
        dbUrl,
        "-f",
        dataFile,
        "--use-copy",
        "--data-only",
        ...excludeArgs,
      ],
    },
  ];
}

export function buildPgdumpDbDumpSteps(
  dbUrl: string,
  outputDir: string,
  excludeTables?: string[],
): DbDumpStep[] {
  const rolesFile = `${outputDir}/roles.sql`;
  const schemaFile = `${outputDir}/schema.sql`;
  const dataFile = `${outputDir}/data.sql`;
  const excludeArgs = buildPgdumpExcludeArgs(excludeTables);

  return [
    {
      kind: "roles",
      label: "roles.sql",
      executable: "pg_dumpall",
      allowFailure: true,
      args: [
        "--roles-only",
        "--no-role-passwords",
        "--dbname",
        dbUrl,
        "--file",
        rolesFile,
      ],
    },
    {
      kind: "schema",
      label: "schema.sql",
      executable: "pg_dump",
      args: [
        "--dbname",
        dbUrl,
        "--schema-only",
        "--no-owner",
        "--no-acl",
        "--file",
        schemaFile,
      ],
    },
    {
      kind: "data",
      label: "data.sql",
      executable: "pg_dump",
      args: [
        "--dbname",
        dbUrl,
        "--data-only",
        "--no-owner",
        "--no-acl",
        "--file",
        dataFile,
        ...excludeArgs,
      ],
    },
  ];
}

export function buildDbDumpSteps(
  engine: DbBackupEngine,
  dbUrl: string,
  outputDir: string,
  excludeTables: string[] | undefined,
  supabaseCli: string,
): DbDumpStep[] {
  if (engine === "pgdump") {
    return buildPgdumpDbDumpSteps(dbUrl, outputDir, excludeTables);
  }
  return buildSupabaseDbDumpSteps(dbUrl, outputDir, excludeTables, supabaseCli);
}

export function validateDbDumpSteps(
  engine: DbBackupEngine,
  steps: DbDumpStep[],
): void {
  if (engine === "supabase-cli") {
    validateSupabaseDumpSteps(steps);
    return;
  }
  validatePgdumpDumpSteps(steps);
}

function validateSupabaseDumpSteps(steps: DbDumpStep[]): void {
  for (const step of steps) {
    const hasExclude = step.args.includes("-x");
    const hasRoleOnly = step.args.includes("--role-only");
    const hasDataOnly = step.args.includes("--data-only");

    if (hasRoleOnly && hasExclude) {
      throw new Error(
        `Comando ${step.label} inválido: --role-only não pode receber -x`,
      );
    }

    if (step.kind === "schema" && hasExclude) {
      throw new Error(
        `Comando ${step.label} inválido: schema dump não pode receber -x`,
      );
    }

    if (hasExclude && !hasDataOnly) {
      throw new Error(
        `Comando ${step.label} inválido: -x só pode aparecer junto com --data-only`,
      );
    }
  }
}

function validatePgdumpDumpSteps(steps: DbDumpStep[]): void {
  for (const step of steps) {
    const hasExclude = step.args.some((arg) => arg === "--exclude-table");

    if ((step.kind === "roles" || step.kind === "schema") && hasExclude) {
      throw new Error(
        `Comando ${step.label} inválido: ${step.kind} dump não pode receber --exclude-table`,
      );
    }

    if (step.kind === "data" && hasExclude && !step.args.includes("--data-only")) {
      throw new Error(
        `Comando ${step.label} inválido: --exclude-table exige --data-only`,
      );
    }

    if (step.executable === "supabase" || step.executable === "npx") {
      throw new Error(
        `Comando ${step.label} inválido: engine pgdump não deve usar supabase CLI`,
      );
    }
  }
}

/** @deprecated Use buildSupabaseDbDumpSteps */
export function buildDbDumpCommands(
  dbUrl: string,
  outputDir: string,
  excludeTables?: string[],
): Array<{ kind: DbDumpKind; label: string; args: string[] }> {
  return buildSupabaseDbDumpSteps(
    dbUrl,
    outputDir,
    excludeTables,
    "supabase",
  ).map(({ kind, label, args }) => ({ kind, label, args }));
}

/** @deprecated Use validateDbDumpSteps */
export function validateDbDumpCommands(
  commands: Array<{ kind: DbDumpKind; label: string; args: string[] }>,
): void {
  validateSupabaseDumpSteps(
    commands.map((command) => ({
      ...command,
      executable: "supabase",
    })),
  );
}