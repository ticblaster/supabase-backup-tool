#!/usr/bin/env node
import { buildCli } from "./cli.js";

async function main(): Promise<void> {
  const program = buildCli();
  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${message}`);
  process.exit(1);
});