export interface ParsedCliCommand {
  executable: string;
  prefixArgs: string[];
}

export function parseCliCommand(commandLine: string): ParsedCliCommand {
  const parts = commandLine.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Comando CLI vazio");
  }

  return {
    executable: parts[0],
    prefixArgs: parts.slice(1),
  };
}