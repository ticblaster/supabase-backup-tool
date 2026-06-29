export function maskConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString();
  } catch {
    return url.replace(/:([^:@/]+)@/, ":****@");
  }
}

export function maskEnvValue(key: string, value: string): string {
  const sensitive =
    /password|secret|token|key|db_url|connection/i.test(key) ||
    value.startsWith("postgresql://") ||
    value.startsWith("postgres://");

  if (!sensitive) {
    return value;
  }

  if (value.startsWith("postgresql://") || value.startsWith("postgres://")) {
    return maskConnectionString(value);
  }

  if (value.length <= 4) {
    return "****";
  }

  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}